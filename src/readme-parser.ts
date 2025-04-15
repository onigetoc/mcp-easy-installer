import { access as fsAccess, readFile as fsReadFile } from 'fs/promises';
import * as path from 'path';
import { debugLog } from './logger.js';

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

    // Find all environment variables in the format KEY=value or KEY=<placeholder>
    debugLog('Looking for KEY=value pairs...');
    const envLines = readmeContent.match(/^[A-Z_]+=(?:<[^>]+>|[^\s]+)/gm) || [];
    if (envLines.length > 0) {
        debugLog(`Found ${envLines.length} potential env variables in KEY=value format`);
        for (const line of envLines) {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key] = value;
                debugLog(`✓ Found env variable: ${key} = ${value}`);
            }
        }
    } else {
        debugLog('No KEY=value pairs found');
    }

    // Also look for env object in any code block (JSON or not)
    debugLog('Looking for code blocks with env objects...');
    // Look for both code blocks and standalone JSON objects
    const codeBlockRegex = /(?:```(?:json)?\s*({[\s\S]*?})|(?:^|\n)\s*({[\s\S]*?"(?:env|mcpServers)"[\s\S]*?}))/gm;
    let match;
    let codeBlockCount = 0;
    while ((match = codeBlockRegex.exec(readmeContent)) !== null) {
        codeBlockCount++;
        const jsonBlock = (match[1] || match[2] || '').trim();
        if (!jsonBlock) {
            debugLog('Empty block, skipping...');
            continue;
        }
        debugLog(`Found code block #${codeBlockCount}`);
        debugLog(`JSON block content: ${jsonBlock}`);
        
        try {
            const parsed = JSON.parse(jsonBlock);
            if (parsed && typeof parsed === 'object') {
                // Check for direct env block
                if (parsed.env && typeof parsed.env === 'object') {
                    Object.entries(parsed.env).forEach(([key, value]) => {
                        if (typeof value === 'string') {
                            envVars[key] = value;
                            debugLog(`✓ Found env variable: ${key} = ${value}`);
                        }
                    });
                }
                
                // Check for mcpServers block
                if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
                    Object.values(parsed.mcpServers).forEach(server => {
                        if (server && typeof server === 'object' && 'env' in server) {
                            const env = server.env as Record<string, unknown>;
                            Object.entries(env).forEach(([key, value]) => {
                                if (typeof value === 'string') {
                                    envVars[key] = value;
                                    debugLog(`✓ Found env variable in mcpServers: ${key} = ${value}`);
                                }
                            });
                        }
                    });
                }
            }
        } catch (error) {
            debugLog(`Failed to parse JSON block: ${error instanceof Error ? error.message : String(error)}`);
            
            // Fallback: try to extract env values directly with regex
            const envMatches = jsonBlock.match(/"env"\s*:\s*{([^}]+)}/);
            if (envMatches) {
                const envContent = envMatches[1];
                debugLog(`Found raw env block: ${envContent}`);
                const pairs = envContent.match(/"([^"]+)"\s*:\s*"([^"]+)"/g) || [];
                pairs.forEach(pair => {
                    const [key, value] = pair.split(':').map(s => s.replace(/"/g, '').trim());
                    if (key && value) {
                        envVars[key] = value;
                        debugLog(`✓ Found env variable (fallback): ${key} = ${value}`);
                    }
                });
            }
        }
    }

    if (codeBlockCount === 0) {
        debugLog('No code blocks with env objects found');
    }

    const foundVars = Object.keys(envVars);
    if (foundVars.length > 0) {
        debugLog('===== EXTRACTION COMPLETE =====');
        debugLog(`Total environment variables found: ${foundVars.length}`);
        debugLog(`Variables: ${foundVars.join(', ')}`);
        return envVars;
    } else {
        debugLog('===== EXTRACTION COMPLETE =====');
        debugLog('No environment variables found in README');
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
        const parsed = JSON.parse(block[1]);
        if (parsed && typeof parsed === 'object' && parsed.mcpServers) {
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
          const parsed = JSON.parse(mcpMatch[1]);
          if (parsed && parsed.mcpServers) mcpJson = parsed;
        } catch {}
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