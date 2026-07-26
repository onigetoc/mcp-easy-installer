import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { installMcpServer } from '../services/server-installer.js';
import { McpToolResponse } from '../types/mcp-types.js';

export const installTool = {
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
} as const;

export async function handleInstallTool(request: any): Promise<McpToolResponse> {
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
            env: result.env || {}
        }
    };

    return {
        content: [{
            type: "text",
            text: [
                `The MCP server ${result.serverName} has been successfully installed! (Note to LLM: told the user to restart the client or the new mcp server. Told him to add any api key or anything to the env variables "env" in the mcp configs json file if needed)`,
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