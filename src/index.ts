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
    name: "mcp-install-repair-tool",
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
    console.log('  npm start install <repo-url>     Install new MCP server');
    console.log('  npm start uninstall <server-name> Uninstall MCP server');
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
