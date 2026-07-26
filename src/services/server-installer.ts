import * as path from 'path';
import { ReadmeParser } from '../parsers/readme-parser.js';
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
  installPythonDependencies,
  ProjectType
} from './download-manager.js';
import { ensureFlowvibeMcpStructure } from '../utils/file-system.js';
import { rm, readFile } from 'fs/promises';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import * as toml from '@iarna/toml';
import { updateAllClientConfigs } from './multi-client-config.js';
import { debugLog } from '../utils/logger.js';
import {
  PackageJsonSchema,
  PyProjectTomlSchema,
  ServerConfigSchema,
  McpConfigSchema,
  InstallResultSchema,
  type InstallResult
} from '../types/schemas.js';

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
        return InstallResultSchema.parse({
          status: "already_installed",
          type: null,
          fullPath: installDir,
          serverName: repoName,
          message: alreadyMsg
        });
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
    if (projectType === 'nodejs') {
      const packageJsonPath = path.join(installDir, 'package.json');
      try {
        const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
        const packageJson = PackageJsonSchema.parse(JSON.parse(packageJsonContent));
        if (packageJson.name) {
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
      const readmeParser = new ReadmeParser();
      const readmeContent = await readmeParser.readLocalReadme(installDir);

      if (readmeContent) {
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
        const packageJson = PackageJsonSchema.parse(JSON.parse(packageJsonContent));
        await buildNodeProject(installDir, packageJson);

        debugLog('=== SEARCHING FOR ENTRY POINT ===');
        
        let outputDirs = ['dist', 'build', '', 'src'];
        try {
          const tsconfigPath = path.join(installDir, 'tsconfig.json');
          if (existsSync(tsconfigPath)) {
            const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
            if (tsconfig.compilerOptions?.outDir) {
              const outDir = tsconfig.compilerOptions.outDir.replace(/^\.\//, '');
              outputDirs = [outDir, ...outputDirs];
              debugLog(`Found outDir in tsconfig.json: ${outDir}`);
            }
          }
        } catch (error) {
          debugLog(`Error reading tsconfig.json: ${error}`);
        }

        // Method 1: Try package.json start script
        if (packageJson.scripts?.start) {
          const startScript = packageJson.scripts.start;
          const scriptMatch = startScript.match(/node\s+(.+\.js)/);
          if (scriptMatch) {
            let startPath = scriptMatch[1];
            for (const dir of outputDirs) {
              const fullPath = path.join(installDir, dir, startPath);
              if (existsSync(fullPath)) {
                entryPoint = path.join(dir, startPath);
                debugLog(`Found entry point from start script in ${dir}: ${entryPoint}`);
                break;
              }
            }
          }
        }

        // Method 2: Try bin field
        if (!entryPoint && packageJson.bin) {
          let binPath = '';
          if (typeof packageJson.bin === 'string') {
            binPath = packageJson.bin;
          } else {
            const binEntries = Object.entries(packageJson.bin);
            const matchingEntry = binEntries.find(([key]) =>
              key === packageJson.name || key.endsWith('-server')
            );
            binPath = matchingEntry ? matchingEntry[1] : binEntries[0]?.[1] ?? '';
          }
          if (binPath) {
            for (const dir of outputDirs) {
              const fullPath = path.join(installDir, dir, binPath);
              if (existsSync(fullPath)) {
                entryPoint = path.join(dir, binPath);
                debugLog(`Found entry point from bin in ${dir}: ${entryPoint}`);
                break;
              }
            }
          }
        }

        // Method 3: Try main field
        if (!entryPoint && packageJson.main) {
          const mainPath = packageJson.main;
          for (const dir of outputDirs) {
            const fullPath = path.join(installDir, dir, mainPath);
            if (existsSync(fullPath)) {
              entryPoint = path.join(dir, mainPath);
              debugLog(`Found entry point from main in ${dir}: ${entryPoint}`);
              break;
            }
          }
        }

        // Method 4: Search for common entry point files
        if (!entryPoint) {
          const searchPatterns = [
            '**/index.js',
            '**/main.js',
            '**/server.js',
            '**/*-server.js',
            '**/cli.js',
            '**/index.ts',
            '**/main.ts',
            '**/server.ts',
            '**/*-server.ts',
            '**/cli.ts'
          ];
          
          for (const dir of outputDirs) {
            debugLog(`Searching in directory: ${dir}`);
            for (const pattern of searchPatterns) {
              const files = await glob(pattern, {
                cwd: path.join(installDir, dir),
                ignore: ['node_modules/**']
              });
              if (files.length > 0) {
                const file = files[0];
                if (file.endsWith('.ts')) {
                  const jsFile = file.replace(/\.ts$/, '.js');
                  const jsPath = path.join(installDir, dir, jsFile);
                  if (existsSync(jsPath)) {
                    entryPoint = path.join(dir, jsFile);
                    debugLog(`Found compiled JS entry point: ${entryPoint}`);
                    break;
                  }
                } else {
                  entryPoint = path.join(dir, files[0]);
                  debugLog(`Found entry point from file search: ${entryPoint}`);
                  break;
                }
              }
            }
            if (entryPoint) break;
          }
        }

        debugLog(`Final entry point: ${entryPoint || 'NOT FOUND'}`);

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
          const parsed = PyProjectTomlSchema.parse(toml.parse(tomlContent));
          
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
      debugLog('=== EXTRACTING ENV VARIABLES ===');
      envVars = readmeParser.extractEnvFromReadme(readmeContent);
      debugLog(`Extracted envVars: ${JSON.stringify(envVars, null, 2)}`);
      
      debugLog('=== EXTRACTING MCP JSON ===');
      mcpJsonResult = readmeParser.extractPythonMcpJsonAndInstall(readmeContent);
      debugLog(`Extracted mcpJson: ${JSON.stringify(mcpJsonResult, null, 2)}`);
      
      if (envVars) {
        debugLog('Found environment variables: ' + Object.keys(envVars).join(', '));
        debugLog('Environment values: ' + JSON.stringify(envVars, null, 2));
      } else {
        debugLog('No environment variables found in README');
      }
    } else {
      debugLog('No README content found');
    }

    // Update MCP config
    let mcpConfig = existsSync(configPath)
      ? McpConfigSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')))
      : { mcpServers: {} };

    // For Python: if README MCP JSON exists, use it
    if (
      (projectType === 'python-pyproject' || projectType === 'python-requirements') &&
      mcpJsonResult && mcpJsonResult.mcpJson && mcpJsonResult.mcpJson.mcpServers
    ) {
      debugLog('=== PROCESSING PYTHON PROJECT CONFIG ===');
      debugLog(`Project type: ${projectType}`);
      debugLog(`MCP JSON Result: ${JSON.stringify(mcpJsonResult, null, 2)}`);
      debugLog(`Current env vars: ${JSON.stringify(envVars, null, 2)}`);

      debugLog('=== MERGING SERVER CONFIGS ===');
      for (const [srv, srvConfig] of Object.entries(mcpJsonResult.mcpJson.mcpServers)) {
        debugLog(`Processing server: ${srv}`);
        debugLog(`Original server config: ${JSON.stringify(srvConfig, null, 2)}`);
        
        const serverConfig = ServerConfigSchema.parse(srvConfig);
        debugLog(`Initial env state: ${JSON.stringify(serverConfig.env, null, 2)}`);
        
        if (!serverConfig.env) {
          debugLog('No env in server config, initializing empty object');
          serverConfig.env = {};
        }
        
        if (envVars) {
          debugLog(`Merging with found env vars: ${JSON.stringify(envVars, null, 2)}`);
          serverConfig.env = { ...serverConfig.env, ...envVars };
          debugLog(`After merge: ${JSON.stringify(serverConfig.env, null, 2)}`);
        }
        
        mcpConfig.mcpServers[srv] = serverConfig;
        debugLog(`Final server config for ${srv}: ${JSON.stringify(mcpConfig.mcpServers[srv], null, 2)}`);
      }
      writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
      debugLog('MCP configuration updated from README MCP JSON');

      const firstSrv = Object.keys(mcpJsonResult.mcpJson.mcpServers)[0];
      const firstConfig = mcpJsonResult.mcpJson.mcpServers[firstSrv];
      return InstallResultSchema.parse({
        serverName: firstSrv,
        command: firstConfig.command,
        args: firstConfig.args,
        type: projectType,
        fullPath: installDir,
        env: firstConfig.env,
        cwd: installDir
      });
    } else {
      const serverConfig = ServerConfigSchema.parse({
        command,
        args,
        enabled: true,
        cwd: installDir,
        env: envVars || {}
      });

      debugLog('Final server configuration:');
      debugLog(`Command: ${command}`);
      debugLog(`Args: ${JSON.stringify(args)}`);
      debugLog(`CWD: ${installDir}`);
      debugLog(`Env: ${JSON.stringify(envVars || {})}`);
      
      mcpConfig.mcpServers[officialServerName] = serverConfig;
      writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
      debugLog(`MCP configuration updated successfully with key: ${officialServerName}`);

      updateAllClientConfigs(officialServerName, serverConfig);

      return InstallResultSchema.parse({
        serverName: officialServerName,
        command,
        args,
        type: projectType === 'unknown' ? 'nodejs' : projectType,
        fullPath: installDir,
        env: serverConfig.env,
        cwd: installDir
      });
    }

  } catch (error) {
    debugLog(`Installation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}