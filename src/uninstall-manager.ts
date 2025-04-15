import { rm, readdir, stat } from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { ensureFlowvibeMcpStructure } from './utils.js';
import { removeFromAllClientConfigs } from './multi-client-config.js';
import { spawnPromise } from 'spawn-rx';
import { debugLog } from './logger.js';

export async function uninstallServer(serverName: string, mcpBasePath: string): Promise<string> {
  debugLog(`Starting uninstallation for ${serverName}`);

  // Try to remove directory first, then always update MCP config
  let configUpdateMsg = '';
  let removedDirMsg = '';
  let targetDir = '';
  let matchingDir: string | undefined = '';
  let searchName = serverName.toLowerCase();

  // Try to remove directory first
  try {
    // Get all directories in MCP path
    const entries = await readdir(mcpBasePath, { withFileTypes: true });
    const dirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
    debugLog(`Found directories: ${JSON.stringify(dirs, null, 2)}`);

    // Find matching directory (case-insensitive, partial match)
    matchingDir = dirs.find(dir =>
      dir.toLowerCase().includes(searchName) ||
      dir.toLowerCase().replace(/[-_]/g, '').includes(searchName)
    );

    if (!matchingDir) {
      removedDirMsg = `Server directory '${serverName}' not found in ${mcpBasePath}`;
    } else {
      debugLog(`Found matching directory: ${matchingDir}`);
      targetDir = path.join(mcpBasePath, matchingDir);

      try {
        // On Windows, try rd /s /q first as it's more reliable
        if (process.platform === 'win32') {
          debugLog('Using Windows rd command for removal');
          await spawnPromise('cmd', ['/c', 'rd', '/s', '/q', targetDir]);
        } else {
          // On other platforms, use rm -rf
          debugLog('Using rm -rf for removal');
          await rm(targetDir, { recursive: true, force: true, maxRetries: 3 });
        }
        debugLog(`Removed directory: ${targetDir}`);
        removedDirMsg = `Removed directory: ${targetDir}`;
      } catch (removeError) {
        debugLog(`First removal attempt failed: ${removeError instanceof Error ? removeError.message : String(removeError)}`);

        // Second attempt: Try to remove read-only flag and retry
        try {
          if (process.platform === 'win32') {
            debugLog('Attempting to remove read-only attributes');
            await spawnPromise('cmd', ['/c', 'attrib', '-R', path.join(targetDir, '*.*'), '/S']);
            await spawnPromise('cmd', ['/c', 'rd', '/s', '/q', targetDir]);
          } else {
            await spawnPromise('chmod', ['-R', '777', targetDir]);
            await rm(targetDir, { recursive: true, force: true });
          }
          debugLog('Second removal attempt successful');
          removedDirMsg = `Removed directory: ${targetDir}`;
        } catch (finalError) {
          removedDirMsg = `Cannot remove directory (permission denied). Please close any programs using files in ${targetDir} and try again.`;
        }
      }
    }
  } catch (error) {
    debugLog(`Directory removal failed: ${error instanceof Error ? error.message : String(error)}`);
    removedDirMsg = 'Error removing server directory.';
  }

  // Always update MCP config, even if directory removal fails
  try {
    const { configPath } = ensureFlowvibeMcpStructure();
    debugLog(`Using config path: ${configPath}`);
    const configStr = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configStr);

    if (config.mcpServers) {
      // Find and remove any server entry that matches (case-insensitive)
      const matchingEntries = Object.keys(config.mcpServers).filter(key =>
        key.toLowerCase().includes(searchName) ||
        key.toLowerCase().replace(/[-_]/g, '').includes(searchName)
      );
      debugLog(`Matching config keys for removal: ${matchingEntries.join(', ')}`);

      if (matchingEntries.length > 0) {
        matchingEntries.forEach(key => {
          debugLog(`Removing config entry: ${key}`);
          delete config.mcpServers[key];
        });

        writeFileSync(configPath, JSON.stringify(config, null, 2));
        debugLog('Updated MCP configuration');
        configUpdateMsg = 'Updated MCP configuration.';
      } else {
        configUpdateMsg = 'No matching server found in MCP configuration.';
      }
    }
  } catch (error) {
    debugLog(`Error updating config: ${error instanceof Error ? error.message : String(error)}`);
    configUpdateMsg = 'Error updating MCP configuration.';

    // Remove from all client configs except base
    removeFromAllClientConfigs(serverName);
  }

  return `Uninstall result for '${serverName}':\n${configUpdateMsg}\n${removedDirMsg}`;
}
