import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { spawnPromise } from 'spawn-rx';
import { FileFinder } from './file-finder.js';
import { ConfigHandler } from './config-handler.js';
import { ReadmeParser } from './readme-parser.js';

export class ServerRepairHandler {
  private readonly fileFinder: FileFinder;
  private readonly configHandler: ConfigHandler;
  private readonly readmeParser: ReadmeParser;

  constructor(
    private readonly mcpBasePath: string,
    private readonly mcpConfigPath: string
  ) {
    this.fileFinder = new FileFinder();
    this.configHandler = new ConfigHandler(mcpConfigPath);
    this.readmeParser = new ReadmeParser();
  }

  async repair(serverName: string): Promise<string> {
    console.log(`Starting repair process for server: ${serverName}`);

    console.log('\n[Step 1] Finding server directory...');
    const serverDir = await this.fileFinder.findMcpServerDirectory(serverName, this.mcpBasePath);
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
    const sourceFile = await this.fileFinder.findSourceFile(serverDir);
    let mainJsFile = await this.fileFinder.findJsFile(serverDir);
    
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
    const packageJson = await this.fileFinder.verifyPackageJson(serverDir);
    if (!packageJson) {
      console.log('  Warning: No valid package.json found');
      if (mainJsFile) {
        // If we have a JS file but no package.json, we can still proceed
        console.log('  Using existing JavaScript file without package.json');
        const config = this.configHandler.generateNodeMcpConfig(mainJsFile, serverName);
        return `Server repaired successfully. Add this configuration:\n\n${config}`;
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
        mainJsFile = await this.fileFinder.findJsFile(serverDir);
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

    // Check README for environment variables
    console.log('\n[Step 5] Checking README for environment variables...');
    let readmeEnv: { [key: string]: string } | null = null;
    
    console.log('\n[Step 5.1] Reading README file...');
    const readmeContent = await this.readmeParser.readLocalReadme(serverDir);
    if (!readmeContent) {
      console.log('  No README.md found, skipping environment variable extraction');
    } else {
      console.log('  Found local README.md, attempting to extract env variables...');
      readmeEnv = this.readmeParser.extractEnvFromReadme(readmeContent);
      
      if (readmeEnv && Object.keys(readmeEnv).length > 0) {
        console.log('  Success: Found environment variables in README:', Object.keys(readmeEnv).join(', '));
      } else {
        console.log('  Warning: No environment variables found in README');
      }
    }

    // Double check env extraction result
    if (!readmeEnv) {
      console.log('  Warning: env extraction returned null or undefined');
    }

    // Generate config
    console.log('\n[Final] Creating MCP server configuration...');
    const mcpConfig = this.configHandler.generateNodeMcpConfig(mainJsFile, serverName, readmeEnv);
    console.log('  Success: Server configuration created');

    // Update MCP config
    const serverConfig = {
      command: "node",
      args: [mainJsFile],
      enabled: true,
      disabled: false,
      autoApprove: [],
      ...(readmeEnv && { env: readmeEnv })
    };
    this.configHandler.updateMcpConfig(serverName, serverConfig);

    const envMsg = readmeEnv 
      ? `\n\nFound environment variables: ${Object.keys(readmeEnv).join(', ')}`
      : '';

    return `Server repaired successfully.${envMsg}\n\nConfiguration has been updated in ${this.mcpConfigPath}:\n\n${mcpConfig}`;
  }
}