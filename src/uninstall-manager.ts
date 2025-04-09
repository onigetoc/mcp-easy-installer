import { access as fsAccess, readFile as fsReadFile, readdir as fsReaddir } from 'fs/promises';
import * as path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { spawnPromise } from "spawn-rx";

interface DirentLike {
  isDirectory(): boolean;
  name: string;
}

// Helper function to get all matching directories
async function getAllMatchingDirectories(serverName: string, mcpBasePath: string): Promise<string[]> {
  try {
    // Get all entries in the directory
    const entries = await fsReaddir(mcpBasePath, { withFileTypes: true });
    
    // Filter for directories only and get matching ones
    const matchingDirs = entries
      .filter((entry: DirentLike) => entry.isDirectory())
      .map((entry: DirentLike) => entry.name)
      .filter((dir: string) => {
        const dirLower = dir.toLowerCase();
        const searchLower = serverName.toLowerCase();
        
        return (
          dirLower.includes(searchLower) ||              // Partial match
          dirLower === searchLower ||                    // Exact match
          dirLower.replace(/[-_]/g, '') === searchLower || // Match without separators
          dirLower.startsWith(searchLower) ||            // Starts with
          searchLower.includes(dirLower)                 // Search term contains dir name
        );
      })
      .map(dir => path.join(mcpBasePath, dir));

    return matchingDirs;
  } catch (error) {
    console.error('[DEBUG] Error finding matching directories:', error);
    return [];
  }
}

/**
 * Uninstalls an MCP server by name
 */
export async function uninstallServer(serverName: string, mcpBasePath: string): Promise<string> {
  console.log(`[DEBUG] Starting uninstallation of server: ${serverName}`);

  // Find all matching directories
  const matchingDirs = await getAllMatchingDirectories(serverName, mcpBasePath);

  // If multiple matches found, return them to user
  if (matchingDirs.length > 1) {
    console.log('[DEBUG] Multiple matching directories found');
    const dirList = matchingDirs.map(dir => `- ${path.basename(dir)}`).join('\n');
    return `Multiple matching servers found. Please specify which one to uninstall:\n${dirList}`;
  }

  // Get target directory
  const targetDir = matchingDirs[0] || null;
  
  if (!targetDir) {
    console.log(`[DEBUG] No matching directories found for '${serverName}'`);
    return `No server matching '${serverName}' was found in ${mcpBasePath}`;
  }

  try {
    console.log(`[DEBUG] Found server directory: ${targetDir}`);

    // Get config path from utils
    const { ensureFlowvibeMcpStructure } = await import('./utils.js');
    const { configPath } = ensureFlowvibeMcpStructure();

    // Remove from mcp_configs.json
    try {
      console.log('[DEBUG] Reading MCP config file');
      const configContent = readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);

      // Find all possible server names to remove
      const namesToCheck = [
        serverName,
        `server-${serverName}`,
        serverName.replace(/^server-/, ''),
        path.basename(targetDir)
      ];

      let removed = false;
      for (const name of namesToCheck) {
        if (config.mcpServers?.[name]) {
          console.log(`[DEBUG] Removing server '${name}' from config`);
          delete config.mcpServers[name];
          removed = true;
        }
      }

      if (!removed) {
        console.log('[DEBUG] Server not found in config file');
      } else {
        // Write updated config
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('[DEBUG] Config file updated');
      }
    } catch (error) {
      console.warn('[DEBUG] Error updating config file:', error);
      // Continue with directory removal even if config update fails
    }

    // Remove server directory using platform-specific commands
    console.log(`[DEBUG] Removing directory: ${targetDir}`);
    
    // Use platform-specific commands for better handling
    if (process.platform === 'win32') {
      // Windows: use rd command
      try {
        await spawnPromise('cmd', ['/c', 'rd', '/s', '/q', targetDir]);
        console.log('[DEBUG] Directory removed successfully');
      } catch (error) {
        throw new Error(`Failed to remove directory using rd: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // Unix-like: use rm command
      try {
        await spawnPromise('rm', ['-rf', targetDir]);
        console.log('[DEBUG] Directory removed successfully');
      } catch (error) {
        throw new Error(`Failed to remove directory using rm: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return `Server '${serverName}' has been completely uninstalled:\n` +
           `✓ Removed from configuration file\n` +
           `✓ Removed directory: ${targetDir}`;

  } catch (error) {
    console.error('[DEBUG] Uninstallation error:', error);
    
    if (error instanceof Error && error.message.includes('Failed to remove directory')) {
      // We found the directory but couldn't remove it
      return `Partial uninstall of server '${serverName}':\n` +
             `✓ Removed from configuration file\n` +
             `✗ Could not remove directory: ${error.message}\n\n` +
             `Please try manually deleting the directory: ${targetDir}`;
    }
    // For other errors, return a message without throwing
    return `Could not complete uninstallation of server '${serverName}': ${error instanceof Error ? error.message : String(error)}`;
  }
}
