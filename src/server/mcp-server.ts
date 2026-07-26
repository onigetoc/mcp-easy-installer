#!/usr/bin/env node

// MCP server for installing, managing, and repairing other MCP servers
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { tools, toolHandlers } from '../tools/index.js';

// Protocol-compliant logging function
function protocolLog(category: string, message: string, data?: any) {
  if (data) {
    console.error(`[${category}] ${message}:`, data);
  } else {
    console.error(`[${category}] ${message}`);
  }
}

// Initialize MCP server
console.error('[Setup] Initializing server...');
const server = new Server(
  {
    name: "mcp-easy-installer",
    description: "MCP server installer and uninstaller for Claude Desktop and VSCode.",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);
console.error('[Setup] Server initialized successfully');

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Tool request handler
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
  protocolLog('API', 'Tool request received', request.params.name);
  try {
    const handler = toolHandlers[request.params.name as keyof typeof toolHandlers];
    if (!handler) {
      protocolLog('Error', 'Unknown tool requested', request.params.name);
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    }

    const result = await handler(request as any);
    return result;
  } catch (error) {
    protocolLog('Error', 'Tool execution failed', error instanceof Error ? error.message : String(error));
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Operation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Start the MCP server
const runServer = async () => {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    protocolLog('Setup', 'MCP server transport connected');
    
    process.on('SIGINT', async () => {
      protocolLog('Setup', 'Received SIGINT. Closing server...');
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    protocolLog('Error', 'Server error', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

// Run the server
runServer().catch(error => {
  protocolLog('Error', 'Fatal server error', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  protocolLog('Error', 'Unhandled Rejection', { promise, reason });
});

process.on('uncaughtException', (error) => {
  protocolLog('Error', 'Uncaught Exception', error.message);
  protocolLog('Error', 'Stack trace', error.stack || 'No stack trace available');
  process.exit(1);
});