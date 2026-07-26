import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { uninstallServer } from '../services/uninstall-manager.js';
import { ensureFlowvibeMcpStructure } from '../utils/file-system.js';
import { McpToolResponse } from '../types/mcp-types.js';

export const uninstallTool = {
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
} as const;

export async function handleUninstallTool(request: any): Promise<McpToolResponse> {
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