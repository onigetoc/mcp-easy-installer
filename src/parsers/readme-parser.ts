import { access as fsAccess, readFile as fsReadFile } from 'fs/promises';
import * as path from 'path';
import { debugLog } from '../utils/logger.js';

export class ReadmeParser {
  /**
   * Extracts the first valid 'env' object from JSON code blocks within Markdown content.
   * It looks for nested structures like { "serverName": { "env": {...} } } or
   * { "mcpServers": { "serverName": { "env": {...} } } }.
   */
  extractEnvFromReadme(readmeContent: string): { [key: string]: string } | null {
    debugLog('===== STARTING ENV VARIABLE EXTRACTION =====');
    debugLog(`README content length: ${readmeContent.length}`);
    
    if (!readmeContent) {
        debugLog('README content is empty!');
        return null;
    }

    // Log first part of content for verification
    debugLog('README content preview:');
    debugLog(readmeContent.substring(0, 200));

    const envVars: { [key: string]: string } = {};

    // 1. Find KEY=value pairs (often used in .env examples)
    debugLog('Looking for KEY=value pairs...');
    // Matches lines starting with an uppercase key, followed by '=', and then the value.
    // Value can be enclosed in <>, or be any non-whitespace character sequence.
    const keyValueRegex = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(?:<([^>]+)>|([^<\s]+))\s*$/gm;
    let keyValueMatch;
    while ((keyValueMatch = keyValueRegex.exec(readmeContent)) !== null) {
        const key = keyValueMatch[1];
        // Value is either group 2 (inside <>) or group 3 (plain value)
        const value = keyValueMatch[2] !== undefined ? `<${keyValueMatch[2]}>` : keyValueMatch[3];
        if (key && value) {
            envVars[key] = value.trim();
            debugLog(`✓ Found env variable (KEY=value): ${key} = ${envVars[key]}`);
        }
    }
    if (Object.keys(envVars).length === 0) {
        debugLog('No KEY=value pairs found');
    }

    // 2. Look for "env": { ... } blocks (common in JSON examples)
    debugLog('Looking for "env": { ... } blocks...');
    // Matches "env": followed by optional whitespace, then a block enclosed in {}
    // Captures the content inside the braces. Uses [\s\S] to match across lines.
    const envBlockRegex = /"env"\s*:\s*({[\s\S]*?})/g;
    let envBlockMatch;
    
    // Log full content only if needed for debugging env blocks
    // debugLog('==== FULL README CONTENT ====');
    // debugLog(readmeContent);
    // debugLog('==== END README CONTENT ====');

    while ((envBlockMatch = envBlockRegex.exec(readmeContent)) !== null) {
        const rawEnvBlock = envBlockMatch[1]; // The content inside {}
        debugLog(`Found potential env block content: ${rawEnvBlock}`);

        // Regex to find "key": value pairs within the block.
        // Key: Must be a quoted string.
        // Value: Can be a quoted string OR an unquoted sequence of non-comma, non-whitespace, non-} characters (handles placeholders like YOUR_KEY).
        const pairRegex = /"([^"]+)"\s*:\s*(?:"([^"]*)"|([^,\s}"']+))/g;
        let pairMatch;
        while ((pairMatch = pairRegex.exec(rawEnvBlock)) !== null) {
            const key = pairMatch[1];
            // Value is either the quoted string (group 2) or the unquoted placeholder (group 3)
            const value = pairMatch[2] !== undefined ? pairMatch[2] : pairMatch[3];
            if (key && value !== undefined) {
                // Avoid overwriting if already found via KEY=value, unless this is a non-placeholder
                 if (!envVars[key] || value.startsWith('"')) {
                    envVars[key] = value.trim();
                    debugLog(`✓ Found env variable (JSON block): ${key} = ${envVars[key]}`);
                 } else {
                    debugLog(`✓ Skipping placeholder ${key} from JSON block as it was already found.`);
                 }
            }
        }
    }
     if (!envBlockMatch && Object.keys(envVars).length === 0) { // Check if any block was ever found
         debugLog('No "env": { ... } blocks found.');
     }


    const foundVars = Object.keys(envVars);
    if (foundVars.length > 0) {
        debugLog('===== EXTRACTION COMPLETE =====');
        debugLog(`Total environment variables found: ${foundVars.length}`);
        debugLog(`Variables: ${JSON.stringify(envVars)}`);
        return envVars;
    } else {
        debugLog('===== EXTRACTION COMPLETE =====');
        debugLog('No environment variables found in README using any method.');
        return null;
    }
  }

  /** Helper function to check if an object contains a valid 'env' property */
  findValidEnvObject(obj: any): { [key: string]: string } | null {
      if (!obj || typeof obj !== 'object') return null;
      
      const envVars: { [key: string]: string } = {};

      // If there's an env object directly, extract its values
      if (obj.env && typeof obj.env === 'object') {
          Object.entries(obj.env).forEach(([key, value]) => {
              if (typeof value === 'string') {
                  envVars[key] = value;
              }
          });
      }

      // Look for any key that looks like an environment variable
      Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'string' && /^[A-Z][A-Z0-9_]*$/.test(key)) {
              envVars[key] = value;
          }
      });

      return Object.keys(envVars).length > 0 ? envVars : null;
  }

  /**
   * Reads the README.md file (case-insensitive) from a local directory
   */
  async readLocalReadme(directory: string): Promise<string> {
    debugLog('===== READING LOCAL README =====');
    debugLog(`Searching in directory: ${directory}`);
    const readmeNames = ['README.md', 'readme.md', 'Readme.md'];
    
    for (const readmeName of readmeNames) {
      const readmePath = path.join(directory, readmeName);
      try {
        await fsAccess(readmePath);
        debugLog(`Found README file: ${readmePath}`);
        const content = await fsReadFile(readmePath, 'utf8');
        debugLog(`Successfully read ${readmeName} (${content.length} characters)`);
        
        // Log preview
        debugLog(`README Preview:\n${content.substring(0, 200)}...`);
        return content;
      } catch (error) {
        debugLog(`${readmeName} not found or not readable in ${directory}`);
      }
    }

    debugLog('No README file found in the directory.');
    return '';
  }

  /**
   * Extracts the first valid MCP server JSON (with "mcpServers") from a README, skipping Docker blocks.
   * Also extracts the first pip install command and the repo URL if present.
   * Returns { mcpJson: object, pipInstall: string|null, repoUrl: string|null }
   */
  extractPythonMcpJsonAndInstall(readmeContent: string): { mcpJson: any, pipInstall: string|null, repoUrl: string|null } | null {
    if (!readmeContent) return null;
    // Remove Docker code blocks
    const noDocker = readmeContent.replace(/```[\s\S]*?docker[\s\S]*?```/gi, '');
    // Find all JSON code blocks
    const jsonBlocks = [...noDocker.matchAll(/```json\s*([\s\S]*?)```/gi)];
    let mcpJson = null;
    for (const block of jsonBlocks) {
      try {
        // First try to find env blocks in the raw JSON
        const envMatches = block[1].match(/"env"\s*:\s*{[\s\S]*?}/g) || [];
        const envVars: Record<string, any> = {};
        
        // Parse each env block found
        for (const envBlock of envMatches) {
          try {
            const envJson = envBlock.replace(/"env"\s*:\s*/, '');
            const parsedEnv = JSON.parse(envJson);
            Object.assign(envVars, parsedEnv);
          } catch (envError) {
            debugLog(`Failed to parse env block: ${envError instanceof Error ? envError.message : String(envError)}`);
          }
        }

        // Now parse the full JSON
        const parsed = JSON.parse(block[1]);
        if (parsed && typeof parsed === 'object' && parsed.mcpServers) {
          // Add enabled: true and restore env to each server config
          Object.values(parsed.mcpServers).forEach(server => {
            if (server && typeof server === 'object') {
              (server as any).enabled = true;
              if (Object.keys(envVars).length > 0) {
                (server as any).env = envVars;
              }
            }
          });
          mcpJson = parsed;
          break;
        }
      } catch {}
    }
    // Fallback: look for any { "mcpServers": ... } outside code blocks
    if (!mcpJson) {
      const mcpMatch = noDocker.match(/({[\s\S]*?"mcpServers"[\s\S]*?})/);
      if (mcpMatch) {
        try {
          // Extract env blocks from the raw JSON first
          const envMatches = mcpMatch[1].match(/"env"\s*:\s*{[\s\S]*?}/g) || [];
          const envVars: Record<string, any> = {};
          
          // Parse each env block found
          for (const envBlock of envMatches) {
            try {
              const envJson = envBlock.replace(/"env"\s*:\s*/, '');
              const parsedEnv = JSON.parse(envJson);
              Object.assign(envVars, parsedEnv);
            } catch (envError) {
              debugLog(`Failed to parse env block: ${envError instanceof Error ? envError.message : String(envError)}`);
            }
          }

          // Now parse the full JSON
          const parsed = JSON.parse(mcpMatch[1]);
          if (parsed && parsed.mcpServers) {
            // Add enabled: true and restore env to each server config
            Object.values(parsed.mcpServers).forEach(server => {
              if (server && typeof server === 'object') {
                (server as any).enabled = true;
                if (Object.keys(envVars).length > 0) {
                  (server as any).env = envVars;
                }
              }
            });
            mcpJson = parsed;
          }
        } catch (error) {
          debugLog(`Failed to parse mcpServers JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    // Find first pip install command
    const pipMatch = noDocker.match(/pip install ([^\s]+)/);
    const pipInstall = pipMatch ? pipMatch[0] : null;
    // Find GitHub repo URL
    const repoMatch = noDocker.match(/https?:\/\/[\w\.-]+\/[^\s)"']+/);
    const repoUrl = repoMatch ? repoMatch[0] : null;
    if (mcpJson) {
      return { mcpJson, pipInstall, repoUrl };
    }
    return null;
  }

}