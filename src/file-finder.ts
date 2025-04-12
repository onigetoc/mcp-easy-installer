import { access as fsAccess, readdir as fsReaddir, readFile as fsReadFile, stat as fsStat } from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as toml from '@iarna/toml';

interface DirentLike {
  isDirectory(): boolean;
  name: string;
}

export interface PackageJson {
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

export class FileFinder {
  private readonly buildDirs = ['dist', 'build'];

  /**
   * Find MCP server directory using fuzzy matching
   */
  async findMcpServerDirectory(serverName: string, mcpBasePath: string): Promise<string | null> {
    console.log(`[DEBUG] Starting search for server: ${serverName}`);
    console.log(`[DEBUG] Base path: ${mcpBasePath}`);
    
    try {
      // First, verify base path exists and is accessible
      await fsAccess(mcpBasePath);
      console.log('[DEBUG] Base path is accessible');

      // Get all entries in the directory
      const entries = await fsReaddir(mcpBasePath, { withFileTypes: true });
      console.log(`[DEBUG] Found ${entries.length} entries in base path`);
      
      // Filter for directories only and get their names
      const dirs = entries
        .filter((entry: DirentLike) => entry.isDirectory())
        .map((entry: DirentLike) => entry.name);
      
      console.log(`[DEBUG] Found directories: ${dirs.join(', ')}`);
      
      // First try to find server in global npm directory
      if (mcpBasePath.includes('@modelcontextprotocol')) {
        const globalServerName = `server-${serverName}`;
        console.log(`[DEBUG] Looking for global npm package: ${globalServerName}`);
        
        const matchingDir = dirs.find(dir => dir === globalServerName);
        if (matchingDir) {
          const fullPath = path.join(mcpBasePath, matchingDir);
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
        const fullPath = path.join(mcpBasePath, matchingDir);
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
   * Find the source TypeScript file (index.ts)
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
   * Find and verify the compiled JavaScript file
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
        // Check bin field
        if (packageJson.bin) {
          let binPath: string | null = null;
          if (typeof packageJson.bin === 'string') {
            binPath = packageJson.bin;
          } else if (typeof packageJson.bin === 'object') {
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

      console.log('  No index files found in any location');
      return null;
    } catch (error) {
      console.error('Error while searching for index files:', error);
      return null;
    }
  }

  /**
   * Find the Python startup script (pyproject.toml scripts or common filenames)
   */
  async findPythonStartupScript(directory: string): Promise<string | null> {
    console.log('[DEBUG] Searching for Python startup script...');

    // 1. Check pyproject.toml for scripts
    const tomlPath = path.join(directory, 'pyproject.toml');
    try {
      await fsAccess(tomlPath);
      console.log('[DEBUG] Found pyproject.toml, attempting to parse...');
      const tomlContent = await fsReadFile(tomlPath, 'utf8');
      const parsedToml: any = toml.parse(tomlContent);
      console.log('[DEBUG] Successfully parsed pyproject.toml');

      const scripts = parsedToml?.project?.scripts || parsedToml?.tool?.poetry?.scripts;
      if (scripts && typeof scripts === 'object' && Object.keys(scripts).length > 0) {
        const firstScriptName = Object.keys(scripts)[0];
        const scriptEntryPoint = scripts[firstScriptName];
        console.log(`[DEBUG] Found script in pyproject.toml: ${firstScriptName} -> ${scriptEntryPoint}`);
        return scriptEntryPoint;
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.log('[DEBUG] pyproject.toml not found.');
      } else {
        console.warn('[DEBUG] Error reading or parsing pyproject.toml:', error);
      }
    }

    // 2. Check for common script filenames if TOML doesn't yield results
    console.log('[DEBUG] Checking common Python script filenames...');
    const commonScripts = ['server.py', 'main.py', 'app.py'];
    for (const scriptName of commonScripts) {
      const scriptPath = path.join(directory, scriptName);
      try {
        await fsAccess(scriptPath);
        console.log(`[DEBUG] Found common script file: ${scriptName}`);
        return scriptName;
      } catch {
        // File not found, continue checking
      }
    }

    console.log('[DEBUG] No Python startup script found.');
    return null;
  }

  /**
   * Verify and read package.json
   */
  async verifyPackageJson(serverPath: string): Promise<PackageJson | null> {
    console.log('[Step 3] Verifying package.json...');
    try {
      const packageJsonPath = path.join(serverPath, 'package.json');
      console.log(`  Reading: ${packageJsonPath}`);
      
      // Verify file exists
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
}