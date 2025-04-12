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

type ServerConfig = {
  command: string;
  args: string[];
  enabled: boolean;
  disabled: boolean;
  autoApprove: string[];
  env?: { [key: string]: string };
};

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
  console.log(`[DEBUG] Starting installation for repository: ${repoUrl}`);

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
        console.log(`[DEBUG] Removed existing directory: ${installDir}`);
      } catch (error) {
        const alreadyMsg =
          `The MCP server "${repoName}" is already installed.\n` +
          `If you have any issues, you can try the repair command.\n` +
          `To remove it, use the uninstall command.`;
        console.log(alreadyMsg);
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
      console.log(`[DEBUG] Downloading npm package to: ${installDir}`);
      await downloadAndExtractNpmPackage(repoUrl, installDir);
    } else {
      console.log(`[DEBUG] Cloning repository to: ${installDir}`);
      const { cloneUrl } = parseGithubUrl(repoUrl);
      await cloneRepository(cloneUrl, installDir);
    }

    // Detect project type
    const projectType = await detectProjectType(installDir);
    console.log(`[DEBUG] Detected project type: ${projectType}`);

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
        await rm(path.join(installDir, 'node_modules'), { recursive: true }).catch(() => {});

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

    // Extract environment variables from README
    const readmeParser = new ReadmeParser();
    const readmeContent = await readmeParser.readLocalReadme(installDir);
    let envVars = null;

    if (readmeContent) {
      envVars = readmeParser.extractEnvFromReadme(readmeContent);
      if (envVars) {
        console.log('[DEBUG] Found environment variables:', Object.keys(envVars).join(', '));
      }
    }

    // Update MCP config
    const mcpConfig: McpConfig = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, 'utf8'))
      : { mcpServers: {} };

    mcpConfig.mcpServers[repoName] = {
      command,
      args,
      enabled: true,
      disabled: false,
      autoApprove: [],
      ...(envVars && { env: envVars })
    };

    writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
    console.log('[DEBUG] MCP configuration updated successfully');

    return {
      serverName: repoName,
      command,
      args,
      type: projectType === 'unknown' ? 'nodejs' : projectType, // Default to nodejs if unknown
      fullPath: installDir,
      ...(envVars && { env: envVars })
    };

  } catch (error) {
    console.error('[DEBUG] Installation failed:', error);
    throw error;
  }
}
