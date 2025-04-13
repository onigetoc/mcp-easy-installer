#!/usr/bin/env node

// test with env:
// npm start install https://github.com/overstarry/qweather-mcp
// Unistall: npm start uninstall server-brave-search
// from npmjs.com: npm start install https://www.npmjs.com/package/@modelcontextprotocol/server-brave-search

// npm start install https://github.com/Garoth/echo-mcp
// python
// npm start install https://github.com/Garoth/echo-mcp

// Important: This tool fixes installation issues with MCP servers and handles uninstallation
// It supports both Node.js and Python MCP servers
// For Node.js servers, it manages dependencies, building, and configuration
// For Python servers, it handles uv installation and virtual environments

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
            enabled: true,
            disabled: false,
            autoApprove: [],
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
            enabled: true,
            disabled: false,
            autoApprove: [],
            ...(result.env && { env: result.env })
          }
        };

        // Add env vars to output if found
        const envMessage = result.env
          ? `\n\nEnvironment Variables:\n${JSON.stringify(result.env, null, 2)}`
          : '\n\nNo environment variables found in README.';

        console.log(JSON.stringify(serverConfig, null, 2));
        console.log(envMessage);
        process.exit(0);
      })
      .catch(error => {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      });
  } else if (command === 'search' && process.argv[3]) {
    // For CLI mode, try to get token from environment
    if (!githubToken) {
      console.error('Error: GITHUB_TOKEN not found in environment');
      console.error('Please add it to your MCP server config in mcp_configs.json:');
      console.error('"env": {');
      console.error('  "GITHUB_TOKEN": "your_github_token"');
      console.error('}');
      process.exit(1);
    }
    
    searchGithubRepos(process.argv[3], githubToken || '')
      .then(results => {
        console.log('\nSearch Results:\n');
        results.forEach(repo => {
          console.log(`Repository: ${repo.name}`);
          console.log(`Description: ${repo.description || 'No description'}`);
          console.log(`Language: ${repo.language || 'Unknown'}`);
          console.log(`Stars: ${repo.stargazers_count}`);
          console.log(`Forks: ${repo.forks_count}`);
          console.log(`URL: ${repo.html_url}`);
          console.log('-------------------\n');
        });
        process.exit(0);
      })
      .catch(error => {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      });
  } else if (command === 'uninstall' && process.argv[3]) {
    uninstallServer(process.argv[3], basePath)
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
    console.log('  npm start install <repo-url>      Install new MCP server');
    console.log('  npm start uninstall <server-name> Uninstall MCP server');
    console.log('  npm start search <query>          Search for MCP servers on GitHub');
    console.log('\nFor search, set GITHUB_TOKEN environment variable first:');
    console.log('  set GITHUB_TOKEN=your_token      (on Windows)');
    console.log('  export GITHUB_TOKEN=your_token   (on Unix)');
    process.exit(1);
  }
} else {
  // MCP server mode
  const transport = new StdioServerTransport();
  server.connect(transport).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
