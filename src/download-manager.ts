import { access as fsAccess, mkdir as fsMkdir, rm as fsRm, readdir as fsReaddir } from 'fs/promises';
import * as path from 'path';
import { spawnPromise } from "spawn-rx";
import * as tar from 'tar';

// System verification utilities
export async function hasNodeJs() {
  try {
    await spawnPromise("node", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

export async function hasUvx() {
  try {
    await spawnPromise("uvx", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

export async function isNpmPackage(name: string) {
  try {
    await spawnPromise("npm", ["view", name, "version"]);
    return true;
  } catch (e) {
    return false;
  }
}


export type ProjectType = 'nodejs' | 'python-pyproject' | 'python-requirements' | 'unknown';

/**
 * Detect the type of project in a directory
 */
export async function detectProjectType(directory: string): Promise<ProjectType> {
  console.log(`[DEBUG] Detecting project type in ${directory}`);
  try {
    await fsAccess(path.join(directory, 'package.json'));
    console.log('[DEBUG] Detected Node.js project (package.json found)');
    return 'nodejs';
  } catch (e) { /* ignore */ }

  try {
    await fsAccess(path.join(directory, 'pyproject.toml'));
    console.log('[DEBUG] Detected Python project (pyproject.toml found)');
    return 'python-pyproject';
  } catch (e) { /* ignore */ }

  try {
    await fsAccess(path.join(directory, 'requirements.txt'));
    console.log('[DEBUG] Detected Python project (requirements.txt found)');
    return 'python-requirements';
  } catch (e) { /* ignore */ }

  console.log('[DEBUG] Could not determine project type');
  return 'unknown';
}

/**
 * Install Python dependencies using uv
 */
export async function installPythonDependencies(directory: string, projectType: 'python-pyproject' | 'python-requirements'): Promise<void> {
  console.log(`[DEBUG] Installing Python dependencies in ${directory} using ${projectType}`);
  if (!(await hasUvx())) {
    throw new Error('Python installation requires `uv` to be installed. Please install it from https://docs.astral.sh/uv');
  }

  try {
    const uvCmd = 'uv'; // Assuming uv is in PATH
    let args: string[];

    if (projectType === 'python-pyproject') {
      args = ['sync'];
      console.log('[DEBUG] Executing: uv sync');
    } else { // python-requirements
      args = ['pip', 'install', '-r', 'requirements.txt'];
      console.log('[DEBUG] Executing: uv pip install -r requirements.txt');
    }

    await spawnPromise(uvCmd, args, { cwd: directory });
    console.log('[DEBUG] Python dependencies installed successfully');

  } catch (error) {
    console.error('[DEBUG] Error during Python dependency installation:', error);
    // It might be okay if dependencies fail (e.g., optional ones), but log prominently.
    // Depending on strictness, you might want to re-throw the error.
    throw new Error(`Failed to install Python dependencies: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse modelcontextprotocol repository URL to get server name
 * Example input: https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search
 * Returns: brave-search
 */
export function parseModelContextUrl(repoUrl: string): string {
  console.log(`[DEBUG] Parsing modelcontextprotocol URL: ${repoUrl}`);
  
  // Check if it's an npmjs.com URL
  if (repoUrl.includes('npmjs.com')) {
    // Extract server name from npm package URL
    // Example: https://www.npmjs.com/package/@modelcontextprotocol/server-memory
    const match = repoUrl.match(/\/package\/@modelcontextprotocol\/server-([^\/]+)$/);
    if (match) {
      const serverName = match[1];
      console.log(`[DEBUG] Extracted server name from npm URL: ${serverName}`);
      return serverName;
    }
  }
  
  // Try GitHub URL format
  // Example: https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search
  const githubMatch = repoUrl.match(/\/src\/([^\/]+)(?:\/)?$/);
  if (githubMatch) {
    const serverName = githubMatch[1];
    console.log(`[DEBUG] Extracted server name from GitHub URL: ${serverName}`);
    return serverName;
  }
  
  throw new Error(
    'Invalid modelcontextprotocol URL format. Expected either:\n' +
    '- GitHub URL: https://github.com/modelcontextprotocol/servers/tree/main/src/SERVER_NAME\n' +
    '- npm URL: https://www.npmjs.com/package/@modelcontextprotocol/server-SERVER_NAME'
  );
}

/**
 * Download and extract a modelcontextprotocol server using npm pack
 */
export async function downloadAndExtractNpmPackage(repoUrl: string, targetDir: string): Promise<void> {
  console.log(`[DEBUG] Downloading npm package for ${repoUrl} into ${targetDir}`);
  
  try {
    // Extract server name from URL
    const serverName = parseModelContextUrl(repoUrl);
    const packageName = `@modelcontextprotocol/server-${serverName}`;
    console.log(`[DEBUG] Using npm package name: ${packageName}`);

    // Create base directory if needed
    const baseDir = path.dirname(targetDir);
    await fsMkdir(baseDir, { recursive: true });

    // Create temporary directory with a unique name
    const tempDir = path.join(baseDir, `.temp-${Date.now()}`);
    console.log(`[DEBUG] Creating temporary directory: ${tempDir}`);
    await fsMkdir(tempDir, { recursive: true, mode: 0o777 });
    console.log(`[DEBUG] Temporary directory created`);

    try {
      // Run npm pack to download the package
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      console.log(`[DEBUG] Running: npm pack ${packageName}`);
      await spawnPromise(npmCmd, ['pack', packageName], { cwd: tempDir });

      // Find the downloaded .tgz file
      const files = await fsReaddir(tempDir);
      const tgzFiles = files.filter(f => f.endsWith('.tgz'));
      if (tgzFiles.length === 0) {
        throw new Error('Could not find downloaded .tgz file');
      }
      if (tgzFiles.length > 1) {
        console.warn('[DEBUG] Multiple .tgz files found, using the first one');
      }
      const tgzFile = tgzFiles[0];

      // Create target directory before extraction
      console.log(`[DEBUG] Creating target directory: ${targetDir}`);
      await fsMkdir(targetDir, { recursive: true });

      // Extract using Node's tar module
      console.log(`[DEBUG] Extracting ${tgzFile} to ${targetDir}`);
      try {
        await tar.x({
          file: path.join(tempDir, tgzFile),
          cwd: targetDir,
          strip: 1
        });
        console.log('[DEBUG] Extraction complete');
      } catch (extractError) {
        console.error('[DEBUG] Tar extraction error:', extractError);
        throw new Error(`Failed to extract package: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
      }

    } finally {
      // Clean up temporary directory
      await fsRm(tempDir, { recursive: true, force: true });
      console.log('[DEBUG] Cleaned up temporary directory');
    }

  } catch (error) {
    console.error('[DEBUG] Error during npm package download:', error);
    throw new Error(`Failed to download and extract npm package: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse GitHub URL or shorthand to get clone URL and repo name
 */
export function parseGithubUrl(repoInput: string): { cloneUrl: string; repoName: string } {
  console.log(`[DEBUG] Parsing GitHub input: ${repoInput}`);
  let cloneUrl = '';
  let repoName = '';

  // Regex to match GitHub URLs (HTTPS and SSH) and shorthand
  const githubUrlRegex = /^(?:https:\/\/github\.com\/|git@github\.com:)([^\/]+\/[^\.\/]+)(?:\.git)?$/;
  const shorthandRegex = /^([^\/]+\/[^\.\/]+)$/;

  const urlMatch = repoInput.match(githubUrlRegex);
  const shorthandMatch = repoInput.match(shorthandRegex);

  if (urlMatch) {
    repoName = urlMatch[1];
    cloneUrl = `https://github.com/${repoName}.git`;
    console.log(`[DEBUG] Matched full URL. Repo: ${repoName}, Clone URL: ${cloneUrl}`);
  } else if (shorthandMatch) {
    repoName = shorthandMatch[1];
    cloneUrl = `https://github.com/${repoName}.git`;
    console.log(`[DEBUG] Matched shorthand. Repo: ${repoName}, Clone URL: ${cloneUrl}`);
  } else {
    console.error('[DEBUG] Invalid GitHub URL or shorthand format');
    throw new Error('Invalid GitHub URL or shorthand format. Use format like `owner/repo` or `https://github.com/owner/repo`.');
  }

  // Extract the final part of the repo name for the directory
  const repoNameParts = repoName.split('/');
  const dirName = repoNameParts[repoNameParts.length - 1];

  return { cloneUrl, repoName: dirName };
}

/**
 * Clone a Git repository
 */
export async function cloneRepository(cloneUrl: string, targetDir: string): Promise<void> {
  console.log(`[DEBUG] Cloning repository ${cloneUrl} into ${targetDir}`);
  try {
    // Create base directory if needed
    const baseDir = path.dirname(targetDir);
    await fsMkdir(baseDir, { recursive: true });

    // Check if directory exists and attempt cleanup if needed
    try {
      const exists = await fsAccess(targetDir)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        console.log('[DEBUG] Found existing installation directory');

        try {
          // Check if it's a valid installation or corrupted
          const hasPackageJson = await fsAccess(path.join(targetDir, 'package.json'))
            .then(() => true)
            .catch(() => false);

          if (hasPackageJson) {
            throw new Error(
              `Installation directory already exists and appears to be a valid installation: ${targetDir}\n` +
              `To reinstall, first remove the existing directory manually.`
            );
          } else {
            console.log('[DEBUG] Existing directory appears to be incomplete/corrupted, cleaning up...');
            await fsRm(targetDir, { recursive: true, force: true });
            console.log('[DEBUG] Cleanup successful');
          }
        } catch (error: any) {
          if (error?.message?.includes('already exists')) {
            throw error; // Rethrow our custom error
          }
          // Other errors during cleanup - warn but continue
          console.warn('[DEBUG] Warning during cleanup:', error?.message || String(error));
        }
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT' && !error?.message?.includes('already exists')) {
        throw error; // Rethrow unexpected errors
      }
      // ENOENT is fine - directory doesn't exist
    }

    // Clone repository with retry
    const maxRetries = 3;
    let retryCount = 0;
    let lastError;

    // Single attempt at cloning - we've already checked directory doesn't exist
    const command = `git clone ${cloneUrl} "${targetDir.replace(/\\/g, '\\\\')}"`;
    console.log(`[DEBUG] Executing git clone: ${command}`);

    try {
      await spawnPromise("git", ["clone", cloneUrl, targetDir]);
      console.log('[DEBUG] Git clone successful');
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.error('[DEBUG] Git clone failed:', errorMessage);

      // Provide more helpful error messages
      if (errorMessage.includes('already exists')) {
        throw new Error(
          `Cannot clone - directory already exists: ${targetDir}\n` +
          `Please remove it manually if you want to reinstall this server.`
        );
      } else {
        throw new Error(`Failed to clone repository: ${errorMessage}`);
      }
    }

  } catch (error) {
    console.error('[DEBUG] Error during git clone:', error);
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Install dependencies using npm
 */
export async function installNodeDependencies(directory: string): Promise<void> {
  console.log(`[DEBUG] Installing dependencies in ${directory}`);
  try {
    // Initial install with --ignore-scripts to avoid prepare/postinstall issues
    console.log('[DEBUG] Executing: npm install --ignore-scripts');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    console.log(`[DEBUG] Using npm command: ${npmCmd}`);
    await spawnPromise(npmCmd, ['install', '--ignore-scripts'], { cwd: directory });
    console.log('[DEBUG] Base npm install successful');

    // Install dev dependencies separately
    try {
      console.log('[DEBUG] Installing dev dependencies...');
      await spawnPromise(npmCmd, ['install', '--save-dev', 'typescript', '@types/node'], {
        cwd: directory,
        env: { ...process.env, npm_config_ignore_scripts: "true" }
      });
      console.log('[DEBUG] Dev dependencies installed');
    } catch (devError) {
      console.warn('[DEBUG] Dev dependencies installation failed:', devError);
      // Continue since dev dependencies might already be in the package
    }
  } catch (error) {
    console.warn('[DEBUG] Error during dependency installation:', error);
    // Don't throw error - the package might already include built files
    console.log('[DEBUG] Continuing despite dependency installation issues');
  }
}

// Define PackageJson interface locally or import if defined elsewhere
interface PackageJson {
  scripts?: {
    [key: string]: string;
  };
  // Add other properties if needed by buildProject
}

/**
 * Build the project using npm build script
 */
export async function buildNodeProject(directory: string, packageJson: PackageJson | null): Promise<void> {
  console.log(`[DEBUG] Building project in ${directory}`);
  if (packageJson?.scripts?.build) {
    console.log('[DEBUG] Found build script, executing: npm run build');
    try {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      console.log(`[DEBUG] Using npm command: ${npmCmd} for build`);
      
      // On Windows, try to handle the shx chmod issue
      if (process.platform === 'win32') {
        // Try to build with cmd.exe and ignore script errors
        await spawnPromise(npmCmd, ['run', 'build'], {
          cwd: directory,
          env: {
            ...process.env,
            npm_config_script_shell: "C:\\Windows\\System32\\cmd.exe",
            npm_config_ignore_scripts: "true"
          }
        });
      } else {
        // On Unix systems, run build normally
        await spawnPromise(npmCmd, ['run', 'build'], { cwd: directory });
      }
      
      console.log('[DEBUG] npm run build successful');
    } catch (error) {
      console.warn('[DEBUG] Build error:', error);
      // Build errors are non-fatal - the package might already include built files
      console.log('[DEBUG] Continuing despite build issues - will try to find existing JS files');
    }
  } else {
    console.log('[DEBUG] No build script found in package.json, skipping build step.');
  }
}