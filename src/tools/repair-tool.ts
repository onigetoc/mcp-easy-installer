import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { uninstallServer } from '../services/uninstall-manager.js';
import { installMcpServer } from '../services/server-installer.js';
import { ensureFlowvibeMcpStructure } from '../utils/file-system.js';
import { debugLog } from '../utils/logger.js';
import { McpToolResponse } from '../types/mcp-types.js';

export const repairTool = {
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
} as const;

export async function handleRepairTool(request: any): Promise<McpToolResponse> {
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
  let installResultData = null;

  try {
    uninstallResultText = await uninstallServer(serverKeyword, basePath);
    debugLog(`Uninstall step completed for keyword '${serverKeyword}'`, uninstallResultText);
  } catch (uninstallError) {
    uninstallResultText = `Uninstall failed for '${serverKeyword}': ${uninstallError instanceof Error ? uninstallError.message : String(uninstallError)}`;
    debugLog(`Uninstall step failed for keyword '${serverKeyword}'`, uninstallError instanceof Error ? uninstallError.message : String(uninstallError));
  }

  try {
    installResultData = await installMcpServer(repoUrl);
    if (installResultData) {
      const serverConfig = {
        [(installResultData.serverName || "unknown")]: {
          command: installResultData.command,
          args: installResultData.args,
          enabled: true,
          env: installResultData.env || {}
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
      debugLog(`Reinstall step completed for URL '${repoUrl}'`);
    } else {
      installResultText = `Reinstallation from '${repoUrl}' completed but returned no data.`;
      debugLog(`Repair reinstall step for URL '${repoUrl}' returned no data`);
    }
  } catch (installError) {
    installResultText = `Reinstallation from '${repoUrl}' failed: ${installError instanceof Error ? installError.message : String(installError)}`;
    debugLog(`Reinstall step failed for URL '${repoUrl}'`, installError instanceof Error ? installError.message : String(installError));
  }

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