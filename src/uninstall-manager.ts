import { rm, readdir, stat } from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { ensureFlowvibeMcpStructure } from './utils.js';
import { removeFromAllClientConfigs } from './multi-client-config.js';
import { spawnPromise } from 'spawn-rx';
import { debugLog } from './logger.js';

export async function uninstallServer(userInputName: string, mcpBasePath: string): Promise<string> {
  debugLog(`Starting uninstallation for user input: ${userInputName}`);

  let configUpdateMsg = '';
  let removedDirMsg = '';
  let officialServerName = ''; // Name from package.json
  let targetDir = ''; // Full path to the directory to remove
  const searchName = userInputName.toLowerCase();

  // --- Step 1: Find Matching Directory and Official Name ---
  try {
    const entries = await readdir(mcpBasePath, { withFileTypes: true });
    const dirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
    debugLog(`All directories in ${mcpBasePath}: ${JSON.stringify(dirs, null, 2)}`);

    // Find *all* matching directories (case-insensitive, partial match)
    const matchingDirs = dirs.filter(dir =>
      dir.toLowerCase().includes(searchName) ||
      dir.toLowerCase().replace(/[-_]/g, '').includes(searchName)
    );
    debugLog(`Matching directories for "${searchName}": ${JSON.stringify(matchingDirs, null, 2)}`);

    if (matchingDirs.length === 0) {
      removedDirMsg = `No server directory found matching '${userInputName}' in ${mcpBasePath}.`;
      // Skip directory removal and config update if no directory found
      return `Uninstall result for '${userInputName}':\n${removedDirMsg}\nNo configuration changes made.`;
    } else if (matchingDirs.length > 1) {
      removedDirMsg = `Multiple directories match '${userInputName}': ${matchingDirs.join(', ')}. Please provide a more specific name.`;
      // Skip directory removal and config update due to ambiguity
      return `Uninstall result for '${userInputName}':\n${removedDirMsg}\nNo configuration changes made.`;
    } else {
      // Exactly one match found
      const matchedDirName = matchingDirs[0];
      targetDir = path.join(mcpBasePath, matchedDirName);
      debugLog(`Unique matching directory found: ${targetDir}`);

      // --- Step 2: Determine Official Server Name ---
      // Attempt 1: Read package.json
      const packageJsonPath = path.join(targetDir, 'package.json');
      let foundName = false;
      try {
        if (readFileSync(packageJsonPath)) { // Check existence first implicitly
          const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
          const packageJson = JSON.parse(packageJsonContent);
          if (typeof packageJson.name === 'string' && packageJson.name) {
            officialServerName = packageJson.name;
            foundName = true;
            debugLog(`Found official server name "${officialServerName}" from ${packageJsonPath}`);
          } else {
             debugLog(`Found ${packageJsonPath}, but "name" field is missing or invalid.`);
          }
        }
      } catch (pkgError) {
         debugLog(`Could not read or parse ${packageJsonPath}: ${pkgError instanceof Error ? pkgError.message : String(pkgError)}`);
      }

      // Attempt 2: Read README.md (if package.json failed)
      if (!foundName) {
        debugLog('Attempting to find official name from README.md');
        const readmeFiles = ['README.md', 'readme.md', 'Readme.md'];
        let readmePath = '';
        let readmeContent = '';

        for (const readmeFile of readmeFiles) {
          try {
            const currentPath = path.join(targetDir, readmeFile);
            // Check existence before reading
            await stat(currentPath); // Throws if doesn't exist
            readmePath = currentPath;
            readmeContent = readFileSync(readmePath, 'utf8');
            debugLog(`Found and read ${readmePath}`);
            break; // Stop searching once found
          } catch (readmeError) {
            // File not found or other error, try next name
             debugLog(`Did not find or could not read ${path.join(targetDir, readmeFile)}`);
          }
        }

        if (readmeContent) {
          // Try to parse the name from the "mcpServers": { "NAME": { ... } } pattern
          const match = readmeContent.match(/"mcpServers"\s*:\s*{\s*"([^"]+)"\s*:/);
          if (match && match[1]) {
            officialServerName = match[1];
            foundName = true;
            debugLog(`Found official server name "${officialServerName}" from ${readmePath}`);
          } else {
             debugLog(`Found ${readmePath}, but could not extract name from "mcpServers" JSON example.`);
          }
        }
      }

      // Handle failure to find name
      if (!foundName) {
        debugLog(`Could not determine official server name from package.json or README.md in ${targetDir}.`);
        removedDirMsg = `Found directory ${matchedDirName}, but could not determine official server name. Config files will not be updated.`;
        officialServerName = ''; // Ensure config update is skipped
      }
      // --- Step 3: Remove Directory ---
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
        debugLog(`Successfully removed directory: ${targetDir}`);
        removedDirMsg = `Removed directory: ${targetDir}`;
      } catch (removeError) {
        debugLog(`First directory removal attempt failed: ${removeError instanceof Error ? removeError.message : String(removeError)}`);
        // Second attempt: Try to remove read-only flag and retry
        try {
          if (process.platform === 'win32') {
            debugLog('Attempting to remove read-only attributes and retry rd');
            await spawnPromise('cmd', ['/c', 'attrib', '-R', path.join(targetDir, '*.*'), '/S']);
            await spawnPromise('cmd', ['/c', 'rd', '/s', '/q', targetDir]);
          } else {
             debugLog('Attempting to chmod and retry rm');
            await spawnPromise('chmod', ['-R', '777', targetDir]);
            await rm(targetDir, { recursive: true, force: true });
          }
          debugLog('Second directory removal attempt successful');
          removedDirMsg = `Removed directory: ${targetDir}`;
        } catch (finalError) {
          debugLog(`Second directory removal attempt failed: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
          removedDirMsg = `Could not remove directory ${targetDir} (permission denied or other issue). Please close any programs using files in it and try again, or remove manually.`;
        }
      }

      // --- Step 4: Update MCP JSON Configs (using officialServerName) ---
      // Only proceed if we determined the official name earlier
      if (officialServerName) {
        try {
          // Update main config
          const { configPath } = ensureFlowvibeMcpStructure();
          debugLog(`Updating main config: ${configPath}`);
          const configStr = readFileSync(configPath, 'utf8');
          const config = JSON.parse(configStr);

          if (config.mcpServers && config.mcpServers[officialServerName]) {
            debugLog(`Removing entry "${officialServerName}" from main config`);
            delete config.mcpServers[officialServerName];
            writeFileSync(configPath, JSON.stringify(config, null, 2));
            configUpdateMsg = `Updated main MCP configuration (removed ${officialServerName}).`;
          } else {
            debugLog(`Entry "${officialServerName}" not found in main config.`);
            configUpdateMsg = `Official server name '${officialServerName}' not found in main MCP configuration.`;
          }
        } catch (mainConfigError) {
          debugLog(`Error updating main config: ${mainConfigError instanceof Error ? mainConfigError.message : String(mainConfigError)}`);
          configUpdateMsg = 'Error updating main MCP configuration.';
        }

        // Update other client configs
         debugLog(`Attempting removal of "${officialServerName}" from other client configs.`);
        removeFromAllClientConfigs(officialServerName); // This function has its own try/catch

      } else {
         debugLog('Skipping config updates as official server name could not be determined.');
         configUpdateMsg = 'Configuration files not updated (could not determine official server name).';
      }
    } // End of 'else' for exactly one matching directory
  } catch (outerError) {
    // Catch errors from readdir, directory matching, or potentially name determination steps
    debugLog(`Error during server lookup or processing: ${outerError instanceof Error ? outerError.message : String(outerError)}`);
    removedDirMsg = `Error during server lookup: ${outerError instanceof Error ? outerError.message : String(outerError)}`;
    configUpdateMsg = 'Configuration files not updated due to error.';
  }

  // --- Step 5: Return Result ---
  // This part is now outside the main try...catch, ensuring it always runs
  return `Uninstall result for '${userInputName}' (Official: ${officialServerName || 'N/A'}):\n${configUpdateMsg}\n${removedDirMsg}`;
}
