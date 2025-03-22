#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs, accessSync } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';
import os from 'os';
const server = new Server({
    name: "mcp-repair-tool",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
class McpRepairTool {
    constructor() {
        this.buildDirs = ['build', 'dist'];
        this.mcpBasePath = this.getMcpBasePath();
    }
    /**
     * Get the MCP base path with environment variable support and validation
     */
    getMcpBasePath() {
        console.log('[DEBUG] Getting MCP base path...');
        // 1. Check environment variable first
        const envPath = process.env.MCP_BASE_PATH;
        if (envPath) {
            try {
                accessSync(envPath);
                console.log(`[DEBUG] Using MCP path from environment: ${envPath}`);
                return envPath;
            }
            catch (error) {
                console.warn(`[DEBUG] Warning: MCP_BASE_PATH ${envPath} is not accessible: ${error}`);
            }
        }
        // 2. Try multiple possible paths
        const homeDir = os.homedir();
        console.log(`[DEBUG] Home directory: ${homeDir}`);
        const possiblePaths = [
            path.join(homeDir, 'OneDrive', 'Documents', 'Cline', 'MCP'),
            path.join(homeDir, 'Documents', 'Cline', 'MCP'),
            path.join(homeDir, 'Cline', 'MCP'),
            // Add current working directory as fallback
            process.cwd()
        ];
        console.log('[DEBUG] Trying possible paths:', possiblePaths);
        for (const testPath of possiblePaths) {
            try {
                accessSync(testPath);
                console.log(`[DEBUG] Found valid MCP path: ${testPath}`);
                return testPath;
            }
            catch (error) {
                console.log(`[DEBUG] Path ${testPath} not accessible: ${error}`);
            }
        }
        // If we get here, no valid path was found
        const errorMsg = `Could not find valid MCP path. Tried:\n${possiblePaths.join('\n')}`;
        console.error('[DEBUG] ' + errorMsg);
        throw new Error(errorMsg);
    }
    /**
     * Use fuzzy matching to find an MCP server directory by name
     */
    async findMcpServerDirectory(serverName) {
        console.log(`[DEBUG] Starting search for server: ${serverName}`);
        console.log(`[DEBUG] Base path: ${this.mcpBasePath}`);
        try {
            // First, verify base path exists and is accessible
            await fs.access(this.mcpBasePath);
            console.log('[DEBUG] Base path is accessible');
            // Get all entries in the directory
            const entries = await fs.readdir(this.mcpBasePath, { withFileTypes: true });
            console.log(`[DEBUG] Found ${entries.length} entries in base path`);
            // Filter for directories only and get their names
            const dirs = entries
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name);
            console.log(`[DEBUG] Found directories: ${dirs.join(', ')}`);
            // Search for matching directory using multiple criteria
            const matchingDir = dirs.find(dir => {
                const dirLower = dir.toLowerCase();
                const searchLower = serverName.toLowerCase();
                // Try different matching strategies
                return (dirLower.includes(searchLower) || // Partial match
                    dirLower === searchLower || // Exact match
                    dirLower.replace(/[-_]/g, '') === searchLower || // Match without separators
                    dirLower.startsWith(searchLower) || // Starts with
                    searchLower.includes(dirLower) // Search term contains dir name
                );
            });
            if (matchingDir) {
                const fullPath = path.join(this.mcpBasePath, matchingDir);
                console.log(`[DEBUG] Found matching directory: ${fullPath}`);
                // Additional verification
                try {
                    const stats = await fs.stat(fullPath);
                    if (!stats.isDirectory()) {
                        console.log('[DEBUG] Matched path is not a directory');
                        return null;
                    }
                    // Check if it has package.json to verify it's likely an MCP server
                    const hasPackageJson = await fs.access(path.join(fullPath, 'package.json'))
                        .then(() => true)
                        .catch(() => false);
                    if (!hasPackageJson) {
                        console.log('[DEBUG] Warning: No package.json found in matched directory');
                    }
                    return fullPath;
                }
                catch (error) {
                    console.log('[DEBUG] Error verifying matched directory:', error);
                    return null;
                }
            }
            console.log('[DEBUG] No matching directory found');
            return null;
        }
        catch (error) {
            console.error('[DEBUG] Error in findMcpServerDirectory:', error);
            return null;
        }
    }
    /**
     * Find the source TypeScript file (index.ts) before anything else
     */
    async findSourceFile(directory) {
        try {
            console.log('[Step 2] Looking for source files...');
            // Check common locations for index.ts
            const searchPaths = [
                '', // root directory
                'src', // src directory
                'src/server', // common server source location
                'lib', // another common location
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
                }
                catch {
                    continue;
                }
            }
            console.log('  No TypeScript source file found');
            return null;
        }
        catch (error) {
            console.error('Error while searching for source files:', error);
            return null;
        }
    }
    /**
     * Find and verify the compiled JavaScript file for the server
     */
    async findJsFile(directory) {
        try {
            console.log('[Step 5] Looking for compiled JavaScript files...');
            // 1. First check package.json paths
            const packageJson = await this.verifyPackageJson(directory);
            if (packageJson) {
                // Check "main" field
                if (packageJson.main) {
                    const mainPath = path.join(directory, packageJson.main);
                    try {
                        await fs.access(mainPath);
                        console.log(`  Found index file in package.json main: ${mainPath}`);
                        return mainPath;
                    }
                    catch {
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
                            await fs.access(scriptPath);
                            console.log(`  Found index file in start script: ${scriptPath}`);
                            return scriptPath;
                        }
                        catch {
                            console.log('  Start script path not accessible:', scriptPath);
                        }
                    }
                }
                // Check "bin" field
                if (packageJson.bin) {
                    let binPath = null;
                    if (typeof packageJson.bin === 'string') {
                        binPath = packageJson.bin;
                    }
                    else if (typeof packageJson.bin === 'object') {
                        // Take the first entry in the bin object
                        const firstBinPath = Object.values(packageJson.bin)[0];
                        if (typeof firstBinPath === 'string') {
                            binPath = firstBinPath;
                        }
                    }
                    if (binPath) {
                        const fullBinPath = path.join(directory, binPath);
                        try {
                            await fs.access(fullBinPath);
                            console.log(`  Found index file in bin: ${fullBinPath}`);
                            return fullBinPath;
                        }
                        catch {
                            console.log('  Bin path not accessible:', fullBinPath);
                        }
                    }
                }
            }
            // 2. Fall back to checking build/dist directories
            for (const buildDir of this.buildDirs) {
                console.log(`  Checking ${buildDir} directory...`);
                const buildPath = path.join(directory, buildDir);
                try {
                    await fs.access(buildPath);
                    const files = await glob('**/index.js', {
                        cwd: buildPath,
                        ignore: ['node_modules/**']
                    });
                    if (files.length > 0) {
                        const foundFile = path.join(buildPath, files[0]);
                        console.log(`  Found index file in ${buildDir}: ${foundFile}`);
                        return foundFile;
                    }
                }
                catch {
                    console.log(`  No ${buildDir} directory found`);
                    continue;
                }
            }
            // 2. Check root directory for JS files only
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
            // 3. Check src directory as last resort
            console.log('  Checking src directory...');
            const srcPath = path.join(directory, 'src');
            try {
                await fs.access(srcPath);
                const srcFiles = await glob('index.js', {
                    cwd: srcPath,
                    ignore: ['node_modules/**']
                });
                if (srcFiles.length > 0) {
                    const foundFile = path.join(srcPath, srcFiles[0]);
                    console.log(`  Found index file in src: ${foundFile}`);
                    return foundFile;
                }
            }
            catch {
                console.log('  No src directory found');
            }
            console.log('  No index files found in any location');
            return null;
        }
        catch (error) {
            console.error('Error while searching for index files:', error);
            return null;
        }
    }
    /**
     * Verify and read package.json
     */
    async verifyPackageJson(serverPath) {
        console.log('[Step 3] Verifying package.json...');
        try {
            const packageJsonPath = path.join(serverPath, 'package.json');
            console.log(`  Reading: ${packageJsonPath}`);
            // Vérifier si le fichier existe
            try {
                await fs.access(packageJsonPath);
                console.log('  package.json file found');
            }
            catch {
                console.log('  package.json file not found');
                return null;
            }
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            console.log('  Successfully parsed package.json');
            return packageJson;
        }
        catch (error) {
            console.error('  Error reading package.json:', error);
            return null;
        }
    }
    /**
     * Check if node_modules exists
     */
    async checkNodeModules(serverPath) {
        console.log('[Step 4] Checking node_modules...');
        try {
            const nodeModulesPath = path.join(serverPath, 'node_modules');
            await fs.access(nodeModulesPath);
            console.log('  node_modules directory found');
            return true;
        }
        catch {
            console.log('  node_modules directory not found');
            return false;
        }
    }
    /**
     * Generate MCP configuration
     */
    generateMcpConfig(jsFilePath, serverName) {
        console.log('[Step 5] Generating MCP configuration...');
        const formattedPath = process.platform === 'win32'
            ? jsFilePath.replace(/\//g, '\\')
            : jsFilePath;
        // Format JSON properly with trailing commas
        const config = {
            [serverName]: {
                command: "node",
                args: [formattedPath],
                enabled: true,
                disabled: false,
                autoApprove: [],
            },
        };
        return JSON.stringify(config, null, 2);
    }
    /**
     * Main repair function
     */
    async repair(serverName) {
        console.log(`Starting repair process for server: ${serverName}`);
        console.log('\n[Step 1] Finding server directory...');
        // Find the server directory
        const serverDir = await this.findMcpServerDirectory(serverName);
        if (!serverDir) {
            console.log('  Error: Server directory not found');
            throw new Error(`Could not find a directory matching '${serverName}'`);
        }
        console.log('  Success: Server directory found');
        // Check for source file first
        console.log('\n[Step 2] Looking for source files...');
        const sourceFile = await this.findSourceFile(serverDir);
        if (!sourceFile) {
            console.log('  Error: No TypeScript source file found');
            throw new Error('Could not find any TypeScript source files. This appears to be an empty or invalid project.');
        }
        console.log('  Success: Found source file at', sourceFile);
        console.log('\n[Step 3] Checking package.json...');
        // Verify package.json
        const packageJson = await this.verifyPackageJson(serverDir);
        if (!packageJson) {
            console.log('  Error: package.json validation failed');
            throw new Error('No valid package.json found');
        }
        console.log('  Success: package.json is valid');
        console.log('\n[Step 3] Installing dependencies...');
        // Check node_modules
        const hasNodeModules = await this.checkNodeModules(serverDir);
        if (!hasNodeModules) {
            console.log('  node_modules not found, installing dependencies...');
            try {
                execSync('npm install', { cwd: serverDir, stdio: 'pipe' });
                console.log('  Dependencies installed successfully');
            }
            catch (error) {
                console.log('  Error: Failed to install dependencies');
                throw new Error(`Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        else {
            console.log('  Success: Dependencies already installed');
        }
        console.log('\n[Step 4] Building project...');
        // Run build if script exists
        if (packageJson.scripts?.build) {
            console.log('  Running build script...');
            try {
                execSync('npm run build', { cwd: serverDir, stdio: 'pipe' });
                console.log('  Success: Build completed');
            }
            catch (error) {
                console.log('  Error: Build failed');
                throw new Error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        else {
            console.log('  No build script found, skipping');
        }
        console.log('\n[Step 5] Locating main JavaScript file...');
        // Find the main JS file
        const jsFilePath = await this.findJsFile(serverDir);
        if (!jsFilePath) {
            console.log('  Error: Main MPC Server JavaScript file not found');
            throw new Error('Could not find the main JavaScript file');
        }
        console.log('  Success: Main JavaScript file found');
        console.log('\n[Step 6] Generating MCP configuration...');
        // Generate MCP configuration
        const mcpConfig = this.generateMcpConfig(jsFilePath, serverName);
        console.log('  Success: Configuration generated');
        return `Server repaired successfully. Add this configuration to your settings file at ${process.platform === 'win32'
            ? 'C:\\Users\\[USERNAME]\\AppData\\Roaming\\Code\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json'
            : '~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'}:\n\n${mcpConfig}`;
    }
}
// Set up MCP server handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "repair_mcp_server",
            description: "Repair, fix or install an MCP server by finding its directory, installing dependencies and building",
            inputSchema: {
                type: "object",
                properties: {
                    serverName: {
                        type: "string",
                        description: "Name of the MCP server to repair (e.g. wikipedia, brave-search)"
                    }
                },
                required: ["serverName"]
            }
        }
    ]
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "repair_mcp_server") {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
    if (!request.params.arguments?.serverName || typeof request.params.arguments.serverName !== "string") {
        throw new McpError(ErrorCode.InvalidParams, "Server name is required");
    }
    const repairTool = new McpRepairTool();
    // Create a promise that resolves after a short delay
    const delayPromise = new Promise(resolve => setTimeout(resolve, 100));
    try {
        // First wait for the delay to ensure stdio is ready
        await delayPromise;
        // Then start the repair process
        console.log("[DEBUG] Starting repair process in MCP server mode");
        const result = await repairTool.repair(request.params.arguments.serverName);
        console.log("[DEBUG] Repair process completed successfully");
        // Add a small delay before returning to ensure all logs are flushed
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            content: [
                {
                    type: "text",
                    text: result
                }
            ]
        };
    }
    catch (error) {
        console.error("[DEBUG] Error in repair process:", error);
        // Add a small delay before returning error to ensure logs are flushed
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to repair server: ${error instanceof Error ? error.message : String(error)}`
                }
            ],
            isError: true
        };
    }
});
// If running as a script
if (process.argv.length > 2) {
    // Handle both formats:
    // - bun start -- test
    // - bun start --test
    const arg = process.argv[2];
    const serverName = arg.startsWith('--') ? arg.substring(2) : arg;
    const repairTool = new McpRepairTool();
    repairTool.repair(serverName)
        .then(result => {
        console.log(result);
        process.exit(0);
    })
        .catch(error => {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    });
}
else {
    // Start the MCP server
    const transport = new StdioServerTransport();
    server.connect(transport).catch(error => {
        process.stderr.write(`Failed to start MCP server: ${error}\n`);
        process.exit(1);
    });
}
