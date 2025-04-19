import * as path from 'path';
import { ReadmeParser } from './readme-parser.js';
import {
  hasNodeJs,
  hasUvx,
  parseGithubUrl,
  parseModelContextUrl,
  cloneRepository,
  downloadAndExtractNpmPackage,
  detectProjectType,
  installNodeDependencies,
  buildNodeProject,
  installPythonDependencies
} from './download-manager.js';
import { ensureFlowvibeMcpStructure } from './utils.js';
import { rm, readFile } from 'fs/promises';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import * as toml from '@iarna/toml';
import { updateAllClientConfigs, ServerConfig } from './multi-client-config.js';
import { debugLog } from './logger.js';

interface PackageJson {
  name: string;
  main?: string;
  scripts?: {
    [key: string]: string;
  };
  dependencies?: {
    [key: string]: string;
  };
  type?: string;
  bin?: string | { [key: string]: string };
}

interface PyProjectToml {
  project?: {
    scripts?: Record<string, string>;
  };
  tool?: {
    poetry?: {
      scripts?: Record<string, string>;
    };
  };
}

type McpConfig = {
  mcpServers: {
    [key: string]: ServerConfig;
  };
};

import { ProjectType } from './download-manager.js';

export type InstallResult = {
  serverName?: string;
  command?: string;
  args?: string[];
  status?: string; // e.g. "success", "already_installed"
  message?: string;
  type: ProjectType | null;
  fullPath: string;
  env?: { [key: string]: string };
};

export async function installMcpServer(repoUrl: string): Promise<InstallResult> {
  // Get MCP paths
  const { basePath, configPath } = ensureFlowvibeMcpStructure();
  debugLog(`Starting installation for repository: ${repoUrl}`);

  // Check dependencies
  const hasNode = await hasNodeJs();
  const hasPython = await hasUvx();

  let repoName = '';
  let installDir = '';

  if (!hasNode && !hasPython) {
    throw new Error('Neither Node.js nor Python (UVX) is installed. Please install at least one of them to continue.');
  }

  try {
    // Parse URL and determine installation location
    if (repoUrl.includes('modelcontextprotocol') || repoUrl.includes('npmjs.com')) {
      const serverName = parseModelContextUrl(repoUrl);
      repoName = `server-${serverName}`;
      installDir = path.join(basePath, repoName);
    } else {
      const { cloneUrl, repoName: parsedName } = parseGithubUrl(repoUrl);
      repoName = parsedName;
      installDir = path.join(basePath, repoName);
    }

    // Remove existing directory if present
    if (existsSync(installDir)) {
      try {
        await rm(installDir, { recursive: true, force: true });
        debugLog(`Removed existing directory: ${installDir}`);
      } catch (error) {
        const alreadyMsg =
          `The MCP server "${repoName}" is already installed.\n` +
          `If you have any issues, you can try the repair command.\n` +
          `To remove it, use the uninstall command.`;
        debugLog(alreadyMsg);
        return {
          status: "already_installed",
          type: null,
          fullPath: installDir,
          serverName: repoName,
          message:
            `The MCP server "${repoName}" is already installed.\n` +
            `If you have any issues, you can try the repair command.\n` +
            `To remove it, use the uninstall command.`
        };
      }
    }

    // Download/clone repository
    if (repoUrl.includes('modelcontextprotocol') || repoUrl.includes('npmjs.com')) {
      debugLog(`Downloading npm package to: ${installDir}`);
      await downloadAndExtractNpmPackage(repoUrl, installDir);
    } else {
      debugLog(`Cloning repository to: ${installDir}`);
      const { cloneUrl } = parseGithubUrl(repoUrl);
      await cloneRepository(cloneUrl, installDir);
    }

    // Detect project type
    const projectType = await detectProjectType(installDir);
    debugLog(`Detected project type: ${projectType}`);

    // --- Determine Official Server Name ---
    let officialServerName = repoName; // Default to repoName as fallback
    let foundOfficialName = false;
    debugLog(`Attempting to determine official server name for directory: ${installDir}`);

    // Attempt 1: Read package.json (Primarily for Node.js)
    if (projectType === 'nodejs') { // Only try package.json for node projects initially
      const packageJsonPath = path.join(installDir, 'package.json');
      try {
        // package.json should exist if type is nodejs, read directly
        const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent) as PackageJson;
        if (typeof packageJson.name === 'string' && packageJson.name) {
          officialServerName = packageJson.name;
          foundOfficialName = true;
          debugLog(`Found official server name "${officialServerName}" from ${packageJsonPath}`);
        } else {
          debugLog(`Found ${packageJsonPath}, but "name" field is missing or invalid.`);
        }
      } catch (pkgError) {
        debugLog(`Could not read or parse ${packageJsonPath}: ${pkgError instanceof Error ? pkgError.message : String(pkgError)}`);
      }
    }

    // Attempt 2: Read README.md (Fallback for all types if package.json didn't yield a name)
    if (!foundOfficialName) {
      debugLog('Attempting to find official name from README.md as fallback');
      const readmeParser = new ReadmeParser(); // Use existing parser instance logic if available or create new
      const readmeContent = await readmeParser.readLocalReadme(installDir); // Assumes this handles finding README.md variations

      if (readmeContent) {
         // Try to parse the name from the "mcpServers": { "NAME": { ... } } pattern
         // Use a more robust regex to handle potential whitespace variations
         const match = readmeContent.match(/"mcpServers"\s*:\s*{\s*"([^"]+)"\s*:\s*{/);
         if (match && match[1]) {
           officialServerName = match[1];
           foundOfficialName = true;
           debugLog(`Found official server name "${officialServerName}" from README.md`);
         } else {
           debugLog(`Found README.md, but could not extract name from "mcpServers" JSON example.`);
         }
      } else {
         debugLog(`No README.md found or readable in ${installDir}.`);
      }
    }

    if (!foundOfficialName) {
       debugLog(`Could not determine official server name from package.json or README.md. Falling back to repository name: "${officialServerName}"`);
    }
    // --- End Determine Official Server Name ---

    // Handle installation based on project type
    let entryPoint: string | null = null;
    let command = '';
    let args: string[] = [];

    switch (projectType) {
      case 'nodejs': {
        if (!hasNode) {
          throw new Error('Node.js is required but not installed');
        }
        
        await installNodeDependencies(installDir);
        const packageJsonPath = path.join(installDir, 'package.json');
        const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent) as PackageJson;
        await buildNodeProject(installDir, packageJson);

        // Clean up node_modules after build
        // Commented out for now to avoid removing node_modules because some mcp server needs it to run and work
        // await rm(path.join(installDir, 'node_modules'), { recursive: true }).catch(() => {});

        // Find entry point
        if (packageJson.bin) {
          if (typeof packageJson.bin === 'string') {
            entryPoint = packageJson.bin;
          } else {
            const binEntries = Object.entries(packageJson.bin);
            const matchingEntry = binEntries.find(([key]) => 
              key === packageJson.name || key.endsWith('-server')
            );
            entryPoint = matchingEntry ? matchingEntry[1] : binEntries[0]?.[1] ?? null;
          }
        }

        if (!entryPoint && packageJson.main) {
          entryPoint = packageJson.main;
        }

        if (!entryPoint) {
          // Search in common locations
          const searchPaths = ['dist', 'build', '', 'src'];
          for (const searchPath of searchPaths) {
            const files = await glob('**/index.js', {
              cwd: path.join(installDir, searchPath),
              ignore: ['node_modules/**']
            });
            if (files.length > 0) {
              entryPoint = path.join(searchPath, files[0]);
              break;
            }
          }
        }

        if (!entryPoint) {
          // Last resort: look for cli.js
          const cliFiles = await glob('**/cli.js', {
            cwd: installDir,
            ignore: ['node_modules/**']
          });
          if (cliFiles.length > 0) {
            entryPoint = cliFiles[0];
          }
        }

        if (!entryPoint) {
          throw new Error('Could not find entry point for Node.js server');
        }

        command = 'node';
        args = [path.resolve(installDir, entryPoint)];
        break;
      }
      
      case 'python-pyproject':
      case 'python-requirements': {
        if (!hasPython) {
          throw new Error('Python (UVX) is required but not installed');
        }

        await installPythonDependencies(installDir, projectType);
        
        if (projectType === 'python-pyproject') {
          const tomlPath = path.join(installDir, 'pyproject.toml');
          const tomlContent = await readFile(tomlPath, 'utf8');
          const parsed = toml.parse(tomlContent) as PyProjectToml;
          
          const projectScripts = parsed.project?.scripts || {};
          const poetryScripts = parsed.tool?.poetry?.scripts || {};
          const allScripts = { ...projectScripts, ...poetryScripts };
          
          if (Object.keys(allScripts).length > 0) {
            entryPoint = Object.values(allScripts)[0];
          }
        }

        if (!entryPoint) {
          const commonFiles = ['server.py', 'main.py', 'app.py', 'cli.py'];
          for (const file of commonFiles) {
            try {
              await readFile(path.join(installDir, file));
              entryPoint = file;
              break;
            } catch {}
          }
        }

        if (!entryPoint) {
          throw new Error('Could not find entry point for Python server');
        }

        command = 'uv';
        args = ['run', path.resolve(installDir, entryPoint)];
        break;
      }
    }

    // Extract environment variables and MCP JSON from README
    const readmeParser = new ReadmeParser();
    const readmeContent = await readmeParser.readLocalReadme(installDir);
    let envVars = null;
    let mcpJsonResult = null;

    if (readmeContent) {
      envVars = readmeParser.extractEnvFromReadme(readmeContent);
      mcpJsonResult = readmeParser.extractPythonMcpJsonAndInstall(readmeContent);
      if (envVars) {
        debugLog('Found environment variables: ' + Object.keys(envVars).join(', '));
      }
    }

    // Update MCP config
    let mcpConfig: McpConfig = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, 'utf8'))
      : { mcpServers: {} };

    // For Python: if README MCP JSON exists, use it
    if (
      (projectType === 'python-pyproject' || projectType === 'python-requirements') &&
      mcpJsonResult && mcpJsonResult.mcpJson && mcpJsonResult.mcpJson.mcpServers
    ) {
      // Merge all servers from README MCP JSON into config
      for (const [srv, srvConfig] of Object.entries(mcpJsonResult.mcpJson.mcpServers)) {
        mcpConfig.mcpServers[srv] = srvConfig as ServerConfig;
      }
      writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
      debugLog('MCP configuration updated from README MCP JSON');
      // Return the first server in the JSON as the result
      const firstSrv = Object.keys(mcpJsonResult.mcpJson.mcpServers)[0];
      const firstConfig = mcpJsonResult.mcpJson.mcpServers[firstSrv];
      return {
        serverName: firstSrv,
        command: firstConfig.command,
        args: firstConfig.args,
        type: projectType,
        fullPath: installDir
      };
    } else {
      // Default: use detected command/args
      const serverConfig: ServerConfig = {
        command,
        args,
        ...(envVars && { env: envVars })
      };

      mcpConfig.mcpServers[officialServerName] = serverConfig; // Use official name
      writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
      debugLog(`MCP configuration updated successfully with key: ${officialServerName}`);

      // Update all client configs except base
      updateAllClientConfigs(officialServerName, serverConfig); // Use official name

      return {
        serverName: officialServerName, // Use official name
        command,
        args,
        type: projectType === 'unknown' ? 'nodejs' : projectType, // Default to nodejs if unknown
        fullPath: installDir,
        ...(envVars && { env: envVars })
      };
    }

  } catch (error) {
    debugLog(`Installation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
