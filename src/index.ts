#!/usr/bin/env node

#!/usr/bin/env node

// Custom debug logger that doesn't interfere with MCP JSON output
function debugLog(message: string) {
  process.stderr.write(`DEBUG: ${message}\n`);
}

// Important: This tool fixes installation issues with MCP servers and handles uninstallation
// It supports both Node.js and Python MCP servers
// For Node.js servers, it manages dependencies, building, and configuration
// For Python servers, it handles uv installation and virtual environments

// Usage examples:
// npm start install https://github.com/overstarry/qweather-mcp
// npm start uninstall server-brave-search
// npm start install https://www.npmjs.com/package/@modelcontextprotocol/server-brave-search

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { searchGithubRepos } from './search.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { ensureFlowvibeMcpStructure } from './utils.js';
import { installMcpServer } from './server-installer.js';
import { uninstallServer } from './uninstall-manager.js';

// Initialize MCP server
const server = new Server(
  {
    name: "mcp-easy-installer",
    description: "MCP server installer and uninstaller. Use with MCP Client Claude or Flowvibe or CLI. Use with npm start install <repo-url> or uninstall <server-name>.",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "install_mcp_server",
      description: 'Install a new MCP server from a GitHub repository URL OR link this: "https://github.com/overstarry/qweather-mcp" OR https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search  or npm package',
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
      name: "search_mcp_server",
      description: "Search for MCP servers on GitHub. Uses GITHUB_TOKEN from server config.",
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for GitHub repositories (e.g. "mcp-server", "language:typescript mcp")',
          },
        },
        required: ['query'],
      },
    },
    {
      name: "uninstall_mcp_server",
      description: "Uninstall an MCP server",
      inputSchema: {
        type: 'object',
        properties: {
          server_name: {
            type: 'string',
            description: 'Name of the server to uninstall',
          },
        },
        required: ['server_name'],
      },
    }
    ,
    {
      name: "repair_mcp_server",
      description: "Repair an MCP server by uninstalling and reinstalling it. Requires the keyword to find the server and the original installation URL.",
      inputSchema: {
        type: 'object',
        properties: {
          server_keyword: {
            type: 'string',
            description: 'Keyword or name to find the server to repair (case-insensitive, partial match)',
          },
          repo_url: {
            type: 'string',
            description: 'The original GitHub URL or npm URL used to install the server',
          },
        },
        required: ['server_keyword', 'repo_url'],
      },
    }
  ]
}));

// Tool request handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case 'install_mcp_server': {
        const repoUrl = request.params.arguments?.repo_url;
        if (typeof repoUrl !== 'string') {
          throw new McpError(ErrorCode.InvalidRequest, 'Missing or invalid repo_url');
        }

        const result = await installMcpServer(repoUrl);

        const serverConfig = {
          [(result.serverName || "unknown")]: {
            command: result.command,
            args: result.args,
            ...(result.env && { env: result.env })
          }
        };

        return {
          content: [{
            type: "text",
            text: [
              `The MCP server ${result.serverName} has been successfully installed!`,
              "",
              "Updated server config:",
              JSON.stringify(serverConfig, null, 2),
              "",
              "Installation Details:",
              JSON.stringify({
                server_name: result.serverName,
                command: result.command,
                startup_args: (result.args || []).join(' '),
                installation_path: result.fullPath,
                server_type: result.type
              }, null, 2)
            ].join('\n')
          }]
        };
      }

      case 'uninstall_mcp_server': {
        const serverName = request.params.arguments?.server_name;
        if (typeof serverName !== 'string') {
          throw new McpError(ErrorCode.InvalidRequest, 'Missing or invalid server_name');
        }

        const { basePath } = ensureFlowvibeMcpStructure();
        const result = await uninstallServer(serverName, basePath);

        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      }

      case 'search_mcp_server': {
        const { query } = request.params.arguments || {};
        if (!query) {
          throw new McpError(ErrorCode.InvalidRequest, 'Missing search query');
        }

        // Get token from environment
        const github_token = process.env.GITHUB_TOKEN;
        if (!github_token) {
          throw new McpError(ErrorCode.InvalidRequest, 'GitHub token not found in environment. Please set GITHUB_TOKEN in your MCP server config.');
        }

        try {
          if (typeof query !== 'string') {
            throw new McpError(ErrorCode.InvalidRequest, 'Search query must be a string');
          }

          const results = await searchGithubRepos(query, github_token);
          
          // Format the results for display
          const formattedResults = results.map(repo => ({
            title: repo.name,
            description: repo.description || 'No description available',
            url: repo.html_url,
            language: repo.language || 'Unknown',
            stars: repo.stargazers_count,
            forks: repo.forks_count
          }));

          return {
            content: [{
              type: "text",
              text: [
                `Found ${results.length} repositories:`,
                "",
                ...formattedResults.map(repo => [
                  `Repository: ${repo.title}`,
                  `Description: ${repo.description}`,
                  `Language: ${repo.language}`,
                  `Stars: ${repo.stars}`,
                  `Forks: ${repo.forks}`,
                  `URL: ${repo.url}`,
                  ""
                ].join('\n'))
              ].join('\n')
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `GitHub search failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      case 'repair_mcp_server': {
        const serverKeyword = request.params.arguments?.server_keyword;
        const repoUrl = request.params.arguments?.repo_url;

        if (typeof serverKeyword !== 'string') {
          throw new McpError(ErrorCode.InvalidRequest, 'Missing or invalid server_keyword');
        }
        if (typeof repoUrl !== 'string') {
          throw new McpError(ErrorCode.InvalidRequest, 'Missing or invalid repo_url');
        }

        const { basePath } = ensureFlowvibeMcpStructure();
        let uninstallResultText = '';
        let installResultText = '';
        let installResultData: Awaited<ReturnType<typeof installMcpServer>> | null = null;

        // Step 1: Uninstall
        try {
          uninstallResultText = await uninstallServer(serverKeyword, basePath);
          debugLog(`Repair: Uninstall step completed for keyword '${serverKeyword}'. Result: ${uninstallResultText}`);
        } catch (uninstallError) {
          uninstallResultText = `Uninstall failed for '${serverKeyword}': ${uninstallError instanceof Error ? uninstallError.message : String(uninstallError)}`;
          debugLog(`Repair: Uninstall step failed for keyword '${serverKeyword}'. Error: ${uninstallError instanceof Error ? uninstallError.message : String(uninstallError)}`);
          // Decide if we should stop or try to install anyway. Let's try to install.
        }

        // Step 2: Install
        try {
          installResultData = await installMcpServer(repoUrl);
          // Only construct success message if installResultData is not null
          if (installResultData) {
            const serverConfig = {
              [(installResultData.serverName || "unknown")]: {
                command: installResultData.command,
                args: installResultData.args,
                ...(installResultData.env && { env: installResultData.env })
              }
            };
            installResultText = [
              `Reinstallation of ${installResultData.serverName} successful!`,
              "",
              "New server config:",
              JSON.stringify(serverConfig, null, 2),
              "",
              "Installation Details:",
              JSON.stringify({
                server_name: installResultData.serverName,
                command: installResultData.command,
                startup_args: (installResultData.args || []).join(' '),
                installation_path: installResultData.fullPath,
                server_type: installResultData.type
              }, null, 2)
            ].join('\n');
            debugLog(`Repair: Reinstall step completed for URL '${repoUrl}'.`);
          } else {
             // This case should ideally not happen if installMcpServer resolves without error but returns null/undefined
             installResultText = `Reinstallation from '${repoUrl}' completed but returned no data.`;
             debugLog(`Warning: Repair reinstall step for URL '${repoUrl}' returned no data.`);
          }
        } catch (installError) {
          installResultText = `Reinstallation from '${repoUrl}' failed: ${installError instanceof Error ? installError.message : String(installError)}`;
          debugLog(`Repair: Reinstall step failed for URL '${repoUrl}'. Error: ${installError instanceof Error ? installError.message : String(installError)}`);
          installResultData = null; // Ensure it's null on error
        }

        // Combine results
        const combinedResult = [
          `Repair process for keyword '${serverKeyword}' using URL '${repoUrl}':`,
          "--- Uninstall Phase ---",
          uninstallResultText,
          "--- Reinstall Phase ---",
          installResultText
        ].join('\n\n');

        return {
          content: [{
            type: "text",
            text: combinedResult
          }]
        };
      }


      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Operation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Handle CLI mode
if (process.argv.length > 2) {
  const command = process.argv[2];
  const { basePath } = ensureFlowvibeMcpStructure();
  const githubToken = process.env.GITHUB_TOKEN;

  if (command === 'install' && process.argv[3]) {
    installMcpServer(process.argv[3])
      .then(result => {
        const serverConfig = {
          [(result.serverName || "unknown")]: {
            command: result.command,
            args: result.args,
            ...(result.env && { env: result.env })
          }
        };

        // Add env vars to output if found
        const envMessage = result.env
          ? `\n\nEnvironment Variables:\n${JSON.stringify(result.env, null, 2)}`
          : '\n\nNo environment variables found in README.';

        // Format output as proper JSON for MCP protocol
        const output = {
          config: serverConfig,
          env_vars: result.env || null,
          status: "success"
        };
        console.log(JSON.stringify(output));
        process.exit(0);
      })
      .catch(error => {
        // Format errors as proper JSON for MCP protocol
        const errorOutput = {
          error: error instanceof Error ? error.message : String(error),
          status: "error"
        };
        console.log(JSON.stringify(errorOutput));
        process.exit(1);
      });
  } else if (command === 'search' && process.argv[3]) {
    // For CLI mode, try to get token from environment
    if (!githubToken) {
      const errorOutput = {
        error: "GITHUB_TOKEN not found in environment. Add to mcp_configs.json: { \"env\": { \"GITHUB_TOKEN\": \"your_token\" } }",
        status: "error"
      };
      console.log(JSON.stringify(errorOutput));
      process.exit(1);
    }
    
    searchGithubRepos(process.argv[3], githubToken || '')
      .then(results => {
        // Format search results as proper JSON for MCP protocol
        const output = {
          results: results.map(repo => ({
            name: repo.name,
            description: repo.description || 'No description',
            language: repo.language || 'Unknown',
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            url: repo.html_url
          })),
          status: "success"
        };
        console.log(JSON.stringify(output));
        process.exit(0);
      })
      .catch(error => {
        const errorOutput = {
          error: error instanceof Error ? error.message : String(error),
          status: "error"
        };
        console.log(JSON.stringify(errorOutput));
        process.exit(1);
      });
  } else if (command === 'uninstall' && process.argv[3]) {
    uninstallServer(process.argv[3], basePath)
      .then(result => {
        console.log(JSON.stringify({ result, status: "success" }));
        process.exit(0);
      })
      .catch(error => {
        console.log(JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          status: "error"
        }));
        process.exit(1);
      });
  } else {
    const usageOutput = {
      error: "Invalid command",
      usage: {
        install: "npm start install <repo-url>      Install new MCP server",
        uninstall: "npm start uninstall <server-name> Uninstall MCP server",
        search: "npm start search <query>          Search for MCP servers on GitHub"
      },
      note: "For search, set GITHUB_TOKEN in mcp_configs.json",
      status: "error"
    };
    console.log(JSON.stringify(usageOutput));
    process.exit(1);
  }
} else {
  // MCP server mode
  const transport = new StdioServerTransport();
  server.connect(transport).catch(error => {
    debugLog(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
