import { rm, readdir, stat } from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { ensureFlowvibeMcpStructure } from './utils.js';
import { removeFromAllClientConfigs } from './multi-client-config.js';
import { spawnPromise } from 'spawn-rx';

export async function uninstallServer(serverName: string, mcpBasePath: string): Promise<string> {
  console.log(`[DEBUG] Starting uninstallation for ${serverName}`);

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
    console.log('[DEBUG] Found directories:', JSON.stringify(dirs, null, 2));

    // Find matching directory (case-insensitive, partial match)
    matchingDir = dirs.find(dir =>
      dir.toLowerCase().includes(searchName) ||
      dir.toLowerCase().replace(/[-_]/g, '').includes(searchName)
    );

    if (!matchingDir) {
      removedDirMsg = `Server directory '${serverName}' not found in ${mcpBasePath}`;
    } else {
      console.log(`[DEBUG] Found matching directory: ${matchingDir}`);
      targetDir = path.join(mcpBasePath, matchingDir);

      try {
        // On Windows, try rd /s /q first as it's more reliable
        if (process.platform === 'win32') {
          console.log('[DEBUG] Using Windows rd command for removal');
          await spawnPromise('cmd', ['/c', 'rd', '/s', '/q', targetDir]);
        } else {
          // On other platforms, use rm -rf
          console.log('[DEBUG] Using rm -rf for removal');
          await rm(targetDir, { recursive: true, force: true, maxRetries: 3 });
        }
        console.log(`[DEBUG] Removed directory: ${targetDir}`);
        removedDirMsg = `Removed directory: ${targetDir}`;
      } catch (removeError) {
        console.error('[DEBUG] First removal attempt failed:', removeError);

        // Second attempt: Try to remove read-only flag and retry
        try {
          if (process.platform === 'win32') {
            console.log('[DEBUG] Attempting to remove read-only attributes');
            await spawnPromise('cmd', ['/c', 'attrib', '-R', path.join(targetDir, '*.*'), '/S']);
            await spawnPromise('cmd', ['/c', 'rd', '/s', '/q', targetDir]);
          } else {
            await spawnPromise('chmod', ['-R', '777', targetDir]);
            await rm(targetDir, { recursive: true, force: true });
          }
          console.log('[DEBUG] Second removal attempt successful');
          removedDirMsg = `Removed directory: ${targetDir}`;
        } catch (finalError) {
          removedDirMsg = `Cannot remove directory (permission denied). Please close any programs using files in ${targetDir} and try again.`;
        }
      }
    }
  } catch (error) {
    console.error('[DEBUG] Directory removal failed:', error);
    removedDirMsg = 'Error removing server directory.';
  }

  // Always update MCP config, even if directory removal fails
  try {
    const { configPath } = ensureFlowvibeMcpStructure();
    console.log('[DEBUG] Using config path:', configPath);
    const configStr = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configStr);

    if (config.mcpServers) {
      // Find and remove any server entry that matches (case-insensitive)
      const matchingEntries = Object.keys(config.mcpServers).filter(key =>
        key.toLowerCase().includes(searchName) ||
        key.toLowerCase().replace(/[-_]/g, '').includes(searchName)
      );
      console.log('[DEBUG] Matching config keys for removal:', matchingEntries);

      if (matchingEntries.length > 0) {
        matchingEntries.forEach(key => {
          console.log(`[DEBUG] Removing config entry: ${key}`);
          delete config.mcpServers[key];
        });

        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('[DEBUG] Updated MCP configuration');
        configUpdateMsg = 'Updated MCP configuration.';
      } else {
        configUpdateMsg = 'No matching server found in MCP configuration.';
      }
    }
  } catch (error) {
    console.log('[DEBUG] Error updating config:', error);
    configUpdateMsg = 'Error updating MCP configuration.';

// Remove from all client configs except base
// Remove from all client configs except base
removeFromAllClientConfigs(serverName);
removeFromAllClientConfigs(serverName);
  }

  // Try to remove directory, but do not block config update if it fails
  try {
    // Get all directories in MCP path
    const entries = await readdir(mcpBasePath, { withFileTypes: true });
    const dirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
    console.log('[DEBUG] Found directories:', JSON.stringify(dirs, null, 2));

    // Find matching directory (case-insensitive, partial match)
    matchingDir = dirs.find(dir =>
      dir.toLowerCase().includes(searchName) ||
      dir.toLowerCase().replace(/[-_]/g, '').includes(searchName)
    );

    if (!matchingDir) {
      removedDirMsg = `Server directory '${serverName}' not found in ${mcpBasePath}`;
    } else {
      console.log(`[DEBUG] Found matching directory: ${matchingDir}`);
      targetDir = path.join(mcpBasePath, matchingDir);

      try {
        // On Windows, try rd /s /q first as it's more reliable
        if (process.platform === 'win32') {
          console.log('[DEBUG] Using Windows rd command for removal');
          await spawnPromise('cmd', ['/c', 'rd', '/s', '/q', targetDir]);
        } else {
          // On other platforms, use rm -rf
          console.log('[DEBUG] Using rm -rf for removal');
          await rm(targetDir, { recursive: true, force: true, maxRetries: 3 });
        }
        console.log(`[DEBUG] Removed directory: ${targetDir}`);
        removedDirMsg = `Removed directory: ${targetDir}`;
      } catch (removeError) {
        console.error('[DEBUG] First removal attempt failed:', removeError);

        // Second attempt: Try to remove read-only flag and retry
        try {
          if (process.platform === 'win32') {
            console.log('[DEBUG] Attempting to remove read-only attributes');
            await spawnPromise('cmd', ['/c', 'attrib', '-R', path.join(targetDir, '*.*'), '/S']);
            await spawnPromise('cmd', ['/c', 'rd', '/s', '/q', targetDir]);
          } else {
            await spawnPromise('chmod', ['-R', '777', targetDir]);
            await rm(targetDir, { recursive: true, force: true });
          }
          console.log('[DEBUG] Second removal attempt successful');
          removedDirMsg = `Removed directory: ${targetDir}`;
        } catch (finalError) {
          removedDirMsg = `Cannot remove directory (permission denied). Please close any programs using files in ${targetDir} and try again.`;
        }
      }
    }
  } catch (error) {
    console.error('[DEBUG] Directory removal failed:', error);
    removedDirMsg = 'Error removing server directory.';
  }

  return `Uninstall result for '${serverName}':\n${configUpdateMsg}\n${removedDirMsg}`;
}
