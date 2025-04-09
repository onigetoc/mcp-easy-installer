#!/usr/bin/env node

// test with env:
// npm start install https://github.com/overstarry/qweather-mcp
// Unistall: npm start uninstall server-brave-search
// from npmjs.com: npm start install https://www.npmjs.com/package/@modelcontextprotocol/server-brave-search

// npm start install https://github.com/Garoth/echo-mcp
// python
// npm start install https://github.com/Garoth/echo-mcp

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { access as fsAccess, readdir as fsReaddir, readFile as fsReadFile, stat as fsStat } from 'fs/promises';
import { accessSync, Dirent, readFileSync, writeFileSync } from 'fs';

interface DirentLike {
  isDirectory(): boolean;
  name: string;
}
import * as path from 'path';
import * as os from 'os';
// Removed child_process import since we use spawnPromise
import { glob } from 'glob';
import { spawnPromise } from "spawn-rx";
import { ensureFlowvibeMcpStructure } from './utils.js';
import {
  hasNodeJs,
  hasUvx,
  isNpmPackage,
  parseGithubUrl,
  parseModelContextUrl,
  cloneRepository,
  downloadAndExtractNpmPackage,
  installDependencies,
  buildProject
} from './download-manager.js';
import { uninstallServer } from './uninstall-manager.js';
const server = new Server(
  {
    name: "mcp-install-repair-tool",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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

class McpRepairTool {
  public readonly mcpBasePath: string;
  public readonly mcpConfigPath: string;
  private readonly buildDirs = ['dist', 'build'];  // Prioritize dist over build since it's more commonly used

  constructor() {
    const { basePath, configPath } = ensureFlowvibeMcpStructure();
    this.mcpBasePath = basePath;
    this.mcpConfigPath = configPath;
  }

  /**
   * Public method to get MCP config path
   */
  public getMcpConfigPath(): string {
    return this.mcpConfigPath;
  }

  /**
   * Update MCP configuration file with new server entry
   */
  private updateMcpConfig(serverName: string, config: any): void { // Changed to sync
    const configPath = this.getMcpConfigPath();
    console.log(`[DEBUG] Updating MCP config at: ${configPath}`);

    try {
      // Read existing config or create new one using synchronous methods
      let fullConfig: any;
      try {
        const existingConfig = readFileSync(configPath, 'utf8');
        fullConfig = JSON.parse(existingConfig);
        console.log('[DEBUG] Successfully read existing config');
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.log('[DEBUG] No existing config found, creating new one');
          fullConfig = { mcpServers: {} };
        } else {
          throw error; // Rethrow other errors
        }
      }

      // Make sure mcpServers exists
      if (!fullConfig.mcpServers) {
        fullConfig.mcpServers = {};
      }

      // Format Windows paths with exactly two backslashes
      // Keep paths with single backslashes, JSON.stringify will handle escaping
      const formattedArgs = config.args?.map((arg: string) => {
        if (typeof arg === 'string') {
          // Ensure single backslashes
          return arg.replace(/\\\\/g, '\\');
        }
        return arg;
      }) ?? [];


      // Add server config
      const serverConfig: any = {
        command: config.command,
        args: formattedArgs,
        enabled: true,
        disabled: false,
        autoApprove: []
      };

      // Add env if present
      if (config.env) {
        serverConfig.env = config.env;
      }

      // Update config object
      fullConfig.mcpServers[serverName] = serverConfig;
// Custom JSON stringifier to handle backslashes
const jsonString = JSON.stringify(fullConfig, (key, value) => {
  if (typeof value === 'string') {
    // Remove any double backslashes before stringifying
    return value.replace(/\\\\/g, '\\');
  }
  return value;
}, 2);

// Write to file synchronously
writeFileSync(configPath, jsonString, 'utf8');


      console.log('[DEBUG] Successfully updated config file');
      console.log('[DEBUG] Added/Updated server config:', JSON.stringify(serverConfig, null, 2));

    } catch (error) {
      console.error('[DEBUG] Failed to update config:', error);
      throw new Error(`Failed to update MCP config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Commenting out getSettingsPath as requested for now
  /*
  private getSettingsPath(): string {
    return process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'Code - Insiders', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
      : path.join(os.homedir(), 'Library', 'Application Support', 'Code - Insiders', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
  }
  */

  /**
   * Get the MCP base path - now uses ensureFlowvibeMcpStructure
   */
  private getMcpBasePath(): string {
    return this.mcpBasePath;
  }

  /**
   * Use fuzzy matching to find an MCP server directory by name
   */
  async findMcpServerDirectory(serverName: string): Promise<string | null> {
    console.log(`[DEBUG] Starting search for server: ${serverName}`);
    console.log(`[DEBUG] Base path: ${this.mcpBasePath}`);
    
    try {
      // First, verify base path exists and is accessible
      await fsAccess(this.mcpBasePath);
      console.log('[DEBUG] Base path is accessible');

      // Get all entries in the directory
      const entries = await fsReaddir(this.mcpBasePath, { withFileTypes: true });
      console.log(`[DEBUG] Found ${entries.length} entries in base path`);
      
      // Filter for directories only and get their names
      const dirs = entries
        .filter((entry: DirentLike) => entry.isDirectory())
        .map((entry: DirentLike) => entry.name);
      
      console.log(`[DEBUG] Found directories: ${dirs.join(', ')}`);
      
      // First try to find server in global npm directory
      if (this.mcpBasePath.includes('@modelcontextprotocol')) {
        const globalServerName = `server-${serverName}`;
        console.log(`[DEBUG] Looking for global npm package: ${globalServerName}`);
        
        const matchingDir = dirs.find(dir => dir === globalServerName);
        if (matchingDir) {
          const fullPath = path.join(this.mcpBasePath, matchingDir);
          console.log(`[DEBUG] Found matching global npm package: ${fullPath}`);
          return fullPath;
        }
      }
      
      // If not found in global npm, try local directories
      console.log('[DEBUG] Searching local directories');
      const matchingDir = dirs.find((dir: string) => {
        const dirLower = dir.toLowerCase();
        const searchLower = serverName.toLowerCase();
        
        // Try different matching strategies for local directories
        return (
          dirLower.includes(searchLower) ||              // Partial match
          dirLower === searchLower ||                    // Exact match
          dirLower.replace(/[-_]/g, '') === searchLower || // Match without separators
          dirLower.startsWith(searchLower) ||            // Starts with
          searchLower.includes(dirLower)                 // Search term contains dir name
        );
      });
      
      if (matchingDir) {
        const fullPath = path.join(this.mcpBasePath, matchingDir);
        console.log(`[DEBUG] Found matching directory: ${fullPath}`);
        
        // Additional verification
        try {
          const stats = await fsStat(fullPath);
          if (!stats.isDirectory()) {
            console.log('[DEBUG] Matched path is not a directory');
            return null;
          }
          
          // Check if it has package.json to verify it's likely an MCP server
          const hasPackageJson = await fsAccess(path.join(fullPath, 'package.json'))
            .then(() => true)
            .catch(() => false);
            
          if (!hasPackageJson) {
            console.log('[DEBUG] Warning: No package.json found in matched directory');
          }
          
          return fullPath;
        } catch (error) {
          console.log('[DEBUG] Error verifying matched directory:', error);
          return null;
        }
      }
      
      console.log('[DEBUG] No matching directory found');
      return null;
      
    } catch (error) {
      console.error('[DEBUG] Error in findMcpServerDirectory:', error);
      return null;
    }
  }

  /**
   * Find the source TypeScript file (index.ts) before anything else
   */
  async findSourceFile(directory: string): Promise<string | null> {
    try {
      console.log('[Step 2] Looking for source files...');
      
      // Check common locations for index.ts
      const searchPaths = [
        '',           // root directory
        'src',        // src directory
        'src/server', // common server source location
        'lib',        // another common location
      ];

      for (const searchPath of searchPaths) {
        const dirToSearch = path.join(directory, searchPath);
        try {
          const files = await glob('**/index.ts', {
            cwd: dirToSearch,
            ignore: ['node_modules/**', 'dist/**', 'build/**']
          });
          
          if (files.length > 0) {
            const foundFile = path.join(dirToSearch, files[0]);
            console.log(`  Found source file: ${foundFile}`);
            return foundFile;
          }
        } catch {
          continue;
        }
      }

      console.log('  No TypeScript source file found');
      return null;
    } catch (error) {
      console.error('Error while searching for source files:', error);
      return null;
    }
  }

  /**
   * Find and verify the compiled JavaScript file for the server
   */
  async findJsFile(directory: string): Promise<string | null> {
    try {
      console.log('[Step 5] Looking for compiled JavaScript files...');
      console.log('[DEBUG] Searching locations in priority order:');
      console.log('[DEBUG] 1. package.json bin field');
      console.log('[DEBUG] 2. package.json main field');
      console.log('[DEBUG] 3. package.json start script');
      console.log('[DEBUG] 4. dist/build directories');
      console.log('[DEBUG] 5. root directory index.js');
      console.log('[DEBUG] 6. src directory index.js');

      // 1. First check package.json paths
      const packageJson = await this.verifyPackageJson(directory);
      if (packageJson) {
        // First check bin field - highest priority for MCP servers
        if (packageJson.bin) {
          let binPath: string | null = null;
          if (typeof packageJson.bin === 'string') {
            binPath = packageJson.bin;
          } else if (typeof packageJson.bin === 'object') {
            // For object format, take first path or matching server name
            const binEntries = Object.entries(packageJson.bin);
            const matchingEntry = binEntries.find(([key]) => 
              key === packageJson.name || key.endsWith('-server')
            );
            binPath = matchingEntry ? matchingEntry[1] : binEntries[0]?.[1];
          }
          
          if (binPath) {
            const fullBinPath = path.join(directory, binPath);
            try {
              await fsAccess(fullBinPath);
              console.log(`  Found index file in bin: ${fullBinPath}`);
              return fullBinPath;
            } catch {
              console.log('  Bin path not accessible:', fullBinPath);
            }
          }
        }

        // Check "main" field
        if (packageJson.main) {
          const mainPath = path.join(directory, packageJson.main);
          try {
              await fsAccess(mainPath);
            console.log(`  Found index file in package.json main: ${mainPath}`);
            return mainPath;
          } catch {
            console.log('  Main path not accessible:', mainPath);
          }
        }

        // Check "scripts.start" field
        if (packageJson.scripts?.start) {
          const startScript = packageJson.scripts.start;
          const match = startScript.match(/node\s+([^\s]+)/);
          if (match) {
            const scriptPath = path.join(directory, match[1]);
            try {
              await fsAccess(scriptPath);
              console.log(`  Found index file in start script: ${scriptPath}`);
              return scriptPath;
            } catch {
              console.log('  Start script path not accessible:', scriptPath);
            }
          }
        }
      }

      // 2. Fall back to checking build/dist directories
      console.log('[DEBUG] Checking build directories in priority order:', this.buildDirs.join(', '));
      for (const buildDir of this.buildDirs) {
        console.log(`[DEBUG] Searching in ${buildDir} directory...`);
        const buildPath = path.join(directory, buildDir);
        try {
          await fsAccess(buildPath);
          const files = await glob('**/index.js', {
            cwd: buildPath,
            ignore: ['node_modules/**']
          });
          if (files.length > 0) {
            const foundFile = path.join(buildPath, files[0]);
            console.log(`  Found index file in ${buildDir}: ${foundFile}`);
            return foundFile;
          }
        } catch {
          console.log(`  No ${buildDir} directory found`);
          continue;
        }
      }

      // 3. Check root directory
      console.log('  Checking root directory...');
      const rootFiles = await glob('index.js', {
        cwd: directory,
        ignore: ['node_modules/**']
      });
      if (rootFiles.length > 0) {
        const foundFile = path.join(directory, rootFiles[0]);
        console.log(`  Found index file in root: ${foundFile}`);
        return foundFile;
      }

      // 4. Check src directory as last resort
      console.log('  Checking src directory...');
      const srcPath = path.join(directory, 'src');
      try {
        await fsAccess(srcPath);
        const srcFiles = await glob('index.js', {
          cwd: srcPath,
          ignore: ['node_modules/**']
        });
        if (srcFiles.length > 0) {
          const foundFile = path.join(srcPath, srcFiles[0]);
          console.log(`  Found index file in src: ${foundFile}`);
          return foundFile;
        }
      } catch {
        console.log('  No src directory found');
      }

      console.log('  No index files found in any location');
      return null;
    } catch (error) {
      console.error('Error while searching for index files:', error);
      return null;
    }
  }

  /**
   * Verify and read package.json
   */
  async verifyPackageJson(serverPath: string): Promise<PackageJson | null> {
    console.log('[Step 3] Verifying package.json...');
    try {
      const packageJsonPath = path.join(serverPath, 'package.json');
      console.log(`  Reading: ${packageJsonPath}`);
      
      // Vérifier si le fichier existe
      try {
        await fsAccess(packageJsonPath);
        console.log('  package.json file found');
      } catch {
        console.log('  package.json file not found');
        return null;
      }

      const packageJsonContent = await fsReadFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      console.log('  Successfully parsed package.json');
      return packageJson;
    } catch (error) {
      console.error('  Error reading package.json:', error);
      return null;
    }
  }

  /**
   * Generate MCP configuration, optionally merging environment variables.
   */
  generateMcpConfig(jsFilePath: string, serverName: string, env?: { [key: string]: string } | null): string {
    console.log(`[DEBUG] Generating MCP config for ${serverName}`);
    // Format Windows paths with exactly two backslashes
    const formattedPath = process.platform === 'win32'
      ? jsFilePath.replace(/\\/g, '\\\\') // Ensure exactly two backslashes
      : jsFilePath;

    const serverConfig: any = {
        command: "node",
        args: [formattedPath],
        enabled: true,
        disabled: false,
        autoApprove: [],
    };

    if (env && typeof env === 'object' && Object.keys(env).length > 0) {
        console.log('[DEBUG] Found environment variables in README:');
        Object.entries(env).forEach(([key, value]) => {
            console.log(`[DEBUG]   ${key} = ${value}`);
        });
        serverConfig.env = env;
    } else {
        console.log('[DEBUG] ⚠️ No environment variables found in README!');
        console.log('[DEBUG] This may cause issues if the MCP server requires environment variables.');
    }

    const config = {
      [serverName]: serverConfig,
    };

    // Convert to JSON with custom stringifier to handle Windows paths
    const jsonString = JSON.stringify(config, (key, value) => {
      if (typeof value === 'string' && process.platform === 'win32') {
        // Convert Windows paths to use single backslashes
        return value.replace(/\\\\/g, '\\');
      }
      return value;
    }, 2);

    console.log(`[DEBUG] Generated config:\n${jsonString}`);
    return jsonString;
  }

  /**
   * Extracts the first valid 'env' object from JSON code blocks within Markdown content.
   * It looks for nested structures like { "serverName": { "env": {...} } } or
   * { "mcpServers": { "serverName": { "env": {...} } } }.
   */
  private extractEnvFromReadme(readmeContent: string): { [key: string]: string } | null {
    console.log('[DEBUG] ===== STARTING ENV VARIABLE EXTRACTION =====');
    console.log('[DEBUG] README content length:', readmeContent.length);
    
    if (!readmeContent) {
        console.log('[DEBUG] README content is empty!');
        return null;
    }

    // Log first part of content for verification
    console.log('[DEBUG] README content preview:');
    console.log(readmeContent.substring(0, 200));

    const envVars: { [key: string]: string } = {};

    // Find all environment variables in the format KEY=value or KEY=<placeholder>
    console.log('[DEBUG] Looking for KEY=value pairs...');
    const envLines = readmeContent.match(/^[A-Z_]+=(?:<[^>]+>|[^\s]+)/gm) || [];
    if (envLines.length > 0) {
        console.log('[DEBUG] Found', envLines.length, 'potential env variables in KEY=value format');
        for (const line of envLines) {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key] = value;
                console.log(`[DEBUG] ✓ Found env variable: ${key} = ${value}`);
            }
        }
    } else {
        console.log('[DEBUG] No KEY=value pairs found');
    }

    // Also look for env object in any code block (JSON or not)
    console.log('[DEBUG] Looking for code blocks with env objects...');
    const codeBlockRegex = /```(?:json)?\s*{[\s\S]*?"env":\s*{([^}]*)}/g;
    let match;
    let codeBlockCount = 0;
    while ((match = codeBlockRegex.exec(readmeContent)) !== null) {
        codeBlockCount++;
        console.log(`[DEBUG] Found code block #${codeBlockCount} containing env object`);
        const envBlock = match[1];
        console.log('[DEBUG] Env block content:', envBlock);
        
        // Extract key-value pairs, allowing any format
        const kvPairs = envBlock.match(/"([^"]+)":\s*(?:"([^"]+)"|<[^>]+>)/g) || [];
        console.log('[DEBUG] Found', kvPairs.length, 'potential key-value pairs');
        
        for (const pair of kvPairs) {
            const [key, value] = pair.split(':').map(s => s.trim().replace(/"/g, ''));
            if (key && value) {
                envVars[key] = value;
                console.log(`[DEBUG] ✓ Found env variable in code block: ${key} = ${value}`);
            }
        }
    }

    if (codeBlockCount === 0) {
        console.log('[DEBUG] No code blocks with env objects found');
    }

    const foundVars = Object.keys(envVars);
    if (foundVars.length > 0) {
        console.log('[DEBUG] ===== EXTRACTION COMPLETE =====');
        console.log('[DEBUG] Total environment variables found:', foundVars.length);
        console.log('[DEBUG] Variables:', foundVars.join(', '));
        return envVars;
    } else {
        console.log('[DEBUG] ===== EXTRACTION COMPLETE =====');
        console.log('[DEBUG] No environment variables found in README');
        return null;
    }
  }

  /** Helper function to check if an object contains a valid 'env' property */
  private findValidEnvObject(obj: any): { [key: string]: string } | null {
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
   * Main install function
   */
  /**
   * Reads the README.md file (case-insensitive) from a local directory.
   */
  private async readLocalReadme(directory: string): Promise<string> {
    console.log('\n[DEBUG] ===== READING LOCAL README =====');
    console.log(`[DEBUG] Searching in directory: ${directory}`);
    const readmeNames = ['README.md', 'readme.md', 'Readme.md'];
    
    for (const readmeName of readmeNames) {
      const readmePath = path.join(directory, readmeName);
      try {
        await fsAccess(readmePath); // Check if file exists
        console.log(`[DEBUG] Found README file: ${readmePath}`);
        const content = await fsReadFile(readmePath, 'utf8');
        console.log(`[DEBUG] Successfully read ${readmeName} (${content.length} characters)`);
        
        // Log preview
        console.log('[DEBUG] README Preview:\n', content.substring(0, 200) + '...');
        return content;
      } catch (error) {
        // If fsAccess fails or fsReadFile fails, it means the file doesn't exist or isn't readable
        console.log(`[DEBUG] ${readmeName} not found or not readable in ${directory}`);
      }
    }

    console.log('[DEBUG] No README file found in the directory.');
    return ''; // Return empty string if no README is found
  }

async install(repoUrl: string): Promise<string> {
  console.log(`Starting installation process for repository: ${repoUrl}`);
  let readmeEnv: { [key: string]: string } | null = null;

  // Check for required dependencies
  // Check installation dependencies and determine type
  const hasNode = await hasNodeJs();
  const hasPython = await hasUvx();

  console.log('\n[Installation Type Detection]');
  if (hasNode) {
    console.log('✓ Node.js is installed - Can handle Node.js MCP servers');
  } else {
    console.log('✗ Node.js is not installed');
  }

  if (hasPython) {
    console.log('✓ Python (UVX) is installed - Can handle Python MCP servers');
  } else {
    console.log('✗ Python (UVX) is not installed');
  }

  if (!hasNode && !hasPython) {
    throw new Error('Neither Node.js nor Python (UVX) is installed. Please install at least one of them to continue.');
  }

  // Log overall installation type
  if (hasNode && hasPython) {
    console.log('\n[INFO] Full installation capabilities - Can handle both Node.js and Python MCP servers');
  } else if (hasNode) {
    console.log('\n[INFO] Node.js-only installation capabilities');
  } else {
    console.log('\n[INFO] Python-only installation capabilities');
  }


    // Helper function for delays between steps
    const stepDelay = async () => new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n[Step 1] Parsing repository URL...');
    let repoName: string;
    let installDir: string;

    // Check if this is a modelcontextprotocol repository or npmjs URL
    if (repoUrl.includes('modelcontextprotocol') || repoUrl.includes('npmjs.com')) {
      // Get server name and construct package name
      const serverName = parseModelContextUrl(repoUrl);
      repoName = `server-${serverName}`;
      installDir = path.join(this.mcpBasePath, repoName);
      console.log(`  Success: Server Name: ${serverName}, Install Dir: ${installDir}`);

      await stepDelay();
      console.log('\n[Step 2] Downloading npm package...');
      try {
        await downloadAndExtractNpmPackage(repoUrl, installDir);
        console.log('  Success: Package downloaded and extracted');
      } catch (error) {
        console.error('[DEBUG] Download failed:', error);
        throw error;
      }
    } else {
      // Handle regular GitHub repository
      const { cloneUrl, repoName: parsedRepoName } = parseGithubUrl(repoUrl);
      repoName = parsedRepoName;
      installDir = path.join(this.mcpBasePath, repoName);
      console.log(`  Success: Repo Name: ${repoName}, Install Dir: ${installDir}`);

      await stepDelay();
      console.log('\n[Step 2] Cloning repository...');
      try {
        await cloneRepository(cloneUrl, installDir);
        console.log('  Success: Repository cloned');
      } catch (error) {
        console.error('[DEBUG] Clone failed:', error);
        throw error;
      }
    }

// Detect project type
console.log('\n[Step 2.1] Detecting project type...');
// Project type detection variables
const projectType = {
  isNode: false,
  isPython: false
};

// Check for package.json (Node.js)
try {
  await fsAccess(path.join(installDir, 'package.json'));
  projectType.isNode = true;
  console.log('  ✓ Found package.json - This appears to be a Node.js project');
} catch {
  console.log('  ✗ No package.json found');
}

// Check for Python project indicators
try {
  const hasPyRequirements = await fsAccess(path.join(installDir, 'requirements.txt'))
    .then(() => true)
    .catch(() => false);
  const hasPyProject = await fsAccess(path.join(installDir, 'pyproject.toml'))
    .then(() => true)
    .catch(() => false);
    
  if (hasPyRequirements || hasPyProject) {
    projectType.isPython = true;
    console.log('  ✓ Found Python project files - This appears to be a Python project');
  }
} catch {
  console.log('  ✗ No Python project files found');
}

if (!projectType.isNode && !projectType.isPython) {
  console.log('  ⚠️ Warning: Could not definitively determine project type');
}

// Handle Python project installation
if (projectType.isPython) {
  console.log('\n[Step 3] Installing Python project...');
  if (await hasUvx()) {
    try {
      await spawnPromise('uvx', ['install'], { cwd: installDir });
      console.log('  ✓ Python dependencies installed via UVX');
    } catch (error) {
      console.error('  ✗ Failed to install Python dependencies:', error);
      throw new Error('Python dependency installation failed');
    }
  } else {
    console.warn('  ⚠️ UVX not installed - Python dependencies cannot be installed');
    console.warn('  Please install UVX to fully support Python MCP servers: https://docs.astral.sh/uv');
  }
}

    console.log('  Success: Repository cloned');

    // Detect project type
    console.log('\n[Step 2.1] Detecting project type...');
    let isNodeProject = false;
    let isPythonProject = false;

    // Check for package.json (Node.js)
    try {
      await fsAccess(path.join(installDir, 'package.json'));
      isNodeProject = true;
      console.log('  ✓ Found package.json - This appears to be a Node.js project');
    } catch {
      console.log('  ✗ No package.json found');
    }

    // Check for requirements.txt or pyproject.toml (Python)
    try {
      const hasPyRequirements = await fsAccess(path.join(installDir, 'requirements.txt'))
        .then(() => true)
        .catch(() => false);
      const hasPyProject = await fsAccess(path.join(installDir, 'pyproject.toml'))
        .then(() => true)
        .catch(() => false);
      
      if (hasPyRequirements || hasPyProject) {
        isPythonProject = true;
        console.log('  ✓ Found Python project files - This appears to be a Python project');
      }
    } catch {
      console.log('  ✗ No Python project files found');
    }

    if (!isNodeProject && !isPythonProject) {
      console.log('  ⚠️ Warning: Could not definitively determine project type');
    } else {
      console.log(`  Project type: ${isNodeProject ? 'Node.js' : 'Python'}`);
    }

    console.log('\n[Step 3] Verifying package.json...');
    const packageJson = await this.verifyPackageJson(installDir);
    if (!packageJson) {
      console.log('  Error: package.json validation failed');
      // Allow installation to continue, maybe it's not a Node.js project or doesn't need build/deps
      console.warn('  Warning: No valid package.json found. Installation might be incomplete if dependencies or build steps are required.');
    } else {
      console.log('  Success: package.json is valid');
    }

    console.log('\n[Step 4] Installing dependencies...');
    if (packageJson) { // Only run npm install if package.json exists
      await installDependencies(installDir);
      console.log('  Success: Dependencies installed');
    } else {
      console.log('  Skipping dependency installation (no package.json)');
    }

    console.log('\n[Step 5] Building project...');
    await buildProject(installDir, packageJson);
    // Build success/failure handled within the function

    // Clean up node_modules after build
    const nodeModulesPath = path.join(installDir, 'node_modules');
    try {
      const { rm } = await import('fs/promises');
      await rm(nodeModulesPath, { recursive: true, force: true });
      console.log('  Cleaned up node_modules directory after build');
    } catch (error) {
      console.log('  No node_modules directory to clean up');
    }
    
    console.log('\n[Step 6] Locating compiled JavaScript file...');
    const jsFile = await this.findJsFile(installDir);
    if (!jsFile) {
      console.log('  Error: Could not find compiled JavaScript file (e.g., index.js)');
      throw new Error('Could not find the main JavaScript file after installation and build. Check the repository structure and build output.');
    }
    console.log('  Success: Found compiled JavaScript at:', jsFile);

    // Config generation moved after reading local README

    // Read local README *before* generating the final message and config
    console.log('\n[Step 6] Reading local README.md for environment variables...');
    try {
      const localReadmeContent = await this.readLocalReadme(installDir);
      if (localReadmeContent) {
        console.log('  Success: Read local README.md');
        readmeEnv = this.extractEnvFromReadme(localReadmeContent); // Update readmeEnv based on local file
        if (readmeEnv) {
          console.log('  Found environment variables in local README:', Object.keys(readmeEnv).join(', '));
        } else {
          console.log('  No environment variables found in local README');
        }
      } else {
        console.log('  No local README.md found.');
      }
    } catch (error) {
      console.warn('  Warning: Error reading local README.md:', error instanceof Error ? error.message : String(error));
    }

    console.log('\n[Step 7] Updating configuration...');
    const serverConfig = {
      command: "node",
      args: [jsFile],
      enabled: true,
      disabled: false,
      autoApprove: [],
      ...(readmeEnv && { env: readmeEnv })
    };

    // Update mcp_configs.json synchronously
    this.updateMcpConfig(repoName, serverConfig);
    console.log('  Success: Local config updated');

    // Generate formatted config string for display
    const mcpConfigString = this.generateMcpConfig(jsFile, repoName, readmeEnv);
    const configPath = this.getMcpConfigPath();

    const envMessage = readmeEnv
      ? `\n\nFound environment variables: ${Object.keys(readmeEnv).join(', ')}\nThese have been added to your configuration in ${configPath}.`
      : `\n\nNo environment variables were found in the README. You may need to configure them manually in ${configPath}.`;

    return `Server '${repoName}' installed successfully from ${repoUrl}.${envMessage}\n\nConfiguration file updated: ${configPath}\n\nGenerated config for reference:\n\n${mcpConfigString}`;
  }

  /**
   * Main repair function
   */
  async repair(serverName: string): Promise<string> {
    console.log(`Starting repair process for server: ${serverName}`);

    console.log('\n[Step 1] Finding server directory...');
    const serverDir = await this.findMcpServerDirectory(serverName);
    if (!serverDir) {
      // Check if this looks like a GitHub URL or username/repo format
      const githubRegex = /^(?:https:\/\/github\.com\/|git@github\.com:)?([^\/]+\/[^\.\/]+)(?:\.git)?$/;
      if (githubRegex.test(serverName)) {
        console.log('  Note: Input looks like a GitHub repository reference');
        throw new Error(
          `Could not find a directory matching '${serverName}'\n` +
          `If you're trying to install a new server from GitHub, use the install command instead:\n` +
          `install_mcp_server with repo_url: "${serverName}"`
        );
      }
      throw new Error(`Could not find a directory matching '${serverName}'. Check the server name and try again.`);
    }
    console.log('  Success: Server directory found at:', serverDir);

    // Look for source files
    console.log('\n[Step 2] Looking for source files...');
    const sourceFile = await this.findSourceFile(serverDir);
    let mainJsFile = await this.findJsFile(serverDir);
    
    if (!sourceFile && !mainJsFile) {
      console.log('  Error: No source files found');
      throw new Error('Could not find any TypeScript or JavaScript source files.');
    }

    if (sourceFile) {
      console.log('  Success: Found TypeScript source at:', sourceFile);
    }
    if (mainJsFile) {
      console.log('  Success: Found JavaScript source at:', mainJsFile);
    }

    console.log('\n[Step 3] Verifying package.json...');
    const packageJson = await this.verifyPackageJson(serverDir);
    if (!packageJson) {
      console.log('  Warning: No valid package.json found');
      if (mainJsFile) {
        // If we have a JS file but no package.json, we can still proceed
        console.log('  Using existing JavaScript file without package.json');
        return `Server repaired successfully. Add this configuration:\n\n${this.generateMcpConfig(mainJsFile, serverName)}`;
      }
      throw new Error('No valid package.json found and no JavaScript file available');
    }
    console.log('  Success: package.json is valid');

    // Run build if needed
    if (!mainJsFile && packageJson.scripts?.build) {
      console.log('\n[Step 4] Building project...');
      try {
        await spawnPromise('npm', ['run', 'build'], { cwd: serverDir });
        console.log('  Success: Build completed');
        mainJsFile = await this.findJsFile(serverDir);
      } catch (error) {
        console.log('  Error: Build failed');
        throw new Error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Final verification
    if (!mainJsFile) {
      console.log('  Error: No JavaScript file found after build');
      throw new Error('Could not find the JavaScript file after build');
    }

    // Attempt to read local README and GitHub README for env vars
    console.log('\n[Step 5] Checking README for environment variables...');
    let readmeEnv: { [key: string]: string } | null = null;
    
    // Try local README first
    const readmePath = path.join(serverDir, 'README.md');
    try {
        await fsAccess(readmePath); // Check if README.md exists
        console.log(`  Found local README.md at: ${readmePath}`);
        const readmeContent = await fsReadFile(readmePath, 'utf8');
        readmeEnv = this.extractEnvFromReadme(readmeContent);
        if (readmeEnv) {
            console.log('  Found environment variables in local README');
        }
    } catch (error) {
        console.log(`  Local README.md not found or could not be read at ${readmePath}. Skipping environment variable extraction from README.`);
    }
    // Removed GitHub README fallback logic. Only local README is checked now.

    if (!readmeEnv) {
        console.log('  No environment variables found in any README files');
    } else {
        console.log('  Found environment variables:', Object.keys(readmeEnv).join(', '));
    }

    // Generate config
    console.log('\n[Final] Creating MCP server configuration...');
    const mcpConfig = this.generateMcpConfig(mainJsFile, serverName, readmeEnv);
    console.log('  Success: Server configuration created');

    const configPath = this.getMcpConfigPath();
    return `Server repaired successfully. Add this configuration to your settings file (${configPath}):\n\n${mcpConfig}`;
  }

}

// Set up MCP server handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "repair_mcp_server",
      description: "Repair, fix an MCP server by finding its directory, installing dependencies and building",
      inputSchema: {
        type: 'object',
        properties: {
          server_name: {
            type: 'string',
            description: 'The name of the MCP server to repair (fuzzy matching)',
          },
        },
        required: ['server_name'],
      },
    },
    {
      name: "install_mcp_server",
      description: "Install a new MCP server from a GitHub repository URL, shorthand (owner/repo), or npm package URL",
      inputSchema: {
        type: 'object',
        properties: {
          repo_url: {
            type: 'string',
            description: 'GitHub URL, shorthand (owner/repo), or npm URL (https://www.npmjs.com/package/@modelcontextprotocol/server-name)',
          },
        },
        required: ['repo_url'],
      },
    },
    {
      name: "uninstall_mcp_server",
      description: "Uninstall an MCP server by removing its directory and configuration",
      inputSchema: {
        type: 'object',
        properties: {
          server_name: {
            type: 'string',
            description: 'The name of the MCP server to uninstall',
          },
        },
        required: ['server_name'],
      },
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const repairTool = new McpRepairTool();
  const delayPromise = new Promise<void>(resolve => setTimeout(resolve, 100));

  try {
    await delayPromise;
    console.log(`[DEBUG] Handling tool call: ${request.params.name}`);

    switch (request.params.name) {
      case 'repair_mcp_server': {
        const serverName = request.params.arguments?.server_name;
        if (typeof serverName !== 'string') {
          throw new McpError(ErrorCode.InvalidRequest, 'Missing or invalid server_name');
        }
        console.log(`[DEBUG] Starting repair for: ${serverName}`);
        const result = await repairTool.repair(serverName);
        console.log("[DEBUG] Repair completed");
        await delayPromise;
        return { content: [{ type: "text", text: result }] };
      }

      case 'install_mcp_server': {
        const repoUrl = request.params.arguments?.repo_url;
        if (typeof repoUrl !== 'string') {
          throw new McpError(ErrorCode.InvalidRequest, 'Missing or invalid repo_url');
        }
        console.log(`[DEBUG] Starting install for: ${repoUrl}`);
        const result = await repairTool.install(repoUrl);
        console.log("[DEBUG] Install completed");
        await delayPromise;
        return { content: [{ type: "text", text: result }] };
      }

      case 'uninstall_mcp_server': {
        const serverName = request.params.arguments?.server_name;
        if (typeof serverName !== 'string') {
          throw new McpError(ErrorCode.InvalidRequest, 'Missing or invalid server_name');
        }
        console.log(`[DEBUG] Starting uninstall for: ${serverName}`);
        const result = await uninstallServer(serverName, repairTool.mcpBasePath);
        console.log("[DEBUG] Uninstall completed");
        await delayPromise;
        return { content: [{ type: "text", text: result }] };
      }

      default: {
        console.error(`[DEBUG] Tool not found: ${request.params.name}`);
        throw new McpError(ErrorCode.MethodNotFound, `Tool '${request.params.name}' not found`);
      }
    }
  } catch (error) {
    console.error(`[DEBUG] Error:`, error);
    await delayPromise;

    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to execute tool: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// CLI mode for testing
if (process.argv.length > 2) {
  const command = process.argv[2];
  const repairTool = new McpRepairTool();

  if (command === 'install' && process.argv[3]) {
    // Install mode: bun start install <repo-url>
    repairTool.install(process.argv[3])
      .then(result => {
        console.log(result);
        process.exit(0);
      })
      .catch(error => {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      });
  } else if (command === 'repair' && process.argv[3]) {
    // Repair mode: bun start repair <server-name>
    repairTool.repair(process.argv[3])
      .then(result => {
        console.log(result);
        process.exit(0);
      })
      .catch(error => {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      });
  } else if (command === 'uninstall' && process.argv[3]) {
    // Uninstall mode: npm start uninstall <server-name>
    uninstallServer(process.argv[3], repairTool.mcpBasePath)
      .then(result => {
        console.log(result);
        process.exit(0);
      })
      .catch(error => {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      });
  } else {
    console.log('Usage:');
    console.log('  npm start install <repo-url>     Install new MCP server');
    console.log('  npm start repair <server-name>   Repair existing MCP server');
    console.log('  npm start uninstall <server-name> Uninstall MCP server');
    process.exit(1);
  }
} else {
  // MCP server mode
  const transport = new StdioServerTransport();
  server.connect(transport).catch(error => {
    process.stderr.write(`Failed to start MCP server: ${error}\n`);
    process.exit(1);
  });
}
