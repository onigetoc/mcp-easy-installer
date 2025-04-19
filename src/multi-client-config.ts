// Multi-client MCP config update logic
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { debugLog } from './logger.js';

export type ServerConfig = {
  command: string;
  args: string[];
  env?: { [key: string]: string };
};

export type McpConfig = {
  mcpServers: {
    [key: string]: ServerConfig;
  };
};

const homedir = os.homedir();

export const clientConfigs: Record<string, string> = {
  flowvibeOnedrive: path.join(homedir, 'OneDrive', 'Documents', 'Flowvibe', 'MCP', 'mcp_configs.json'),
  dive: path.join(homedir, 'AppData', 'Roaming', 'dive', 'Config', 'config.json'),
  flowvibe: path.join(homedir, 'Documents', 'Flowvibe', 'MCP', 'mcp_configs.json'),
  claude: path.join(homedir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  cursor: path.join(homedir, '.cursor', 'mcp.json'),
  windsurf: path.join(homedir, 'AppData', 'Roaming', 'Codeium', 'windsurf', 'mcp_config.json'),
//   vsc: path.join(homedir, 'AppData', 'Roaming', 'Code', 'User', 'settings.json'),
//   vscInsider: path.join(homedir, 'AppData', 'Roaming', 'Code - Insiders', 'User', 'settings.json'),
  roocodeVsc: path.join(homedir, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json'),
  roocodeInsider: path.join(homedir, 'AppData', 'Roaming', 'Code - Insiders', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json'),
  roocodeCursor: path.join(homedir, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json'),
  clineVsc: path.join(homedir, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
  clineInsider: path.join(homedir, 'AppData', 'Roaming', 'Code - Insiders', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
  clineCursor: path.join(homedir, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
};

const BASE_CONFIG_PATHS = [
  clientConfigs.flowvibeOnedrive,
  clientConfigs.flowvibe,
];

// Helper: is base config (do not overwrite/remove)
function isBaseConfig(configPath: string): boolean {
  return BASE_CONFIG_PATHS.includes(configPath);
}

// Update all client configs (install)
export function updateAllClientConfigs(serverName: string, serverConfig: ServerConfig) {
  debugLog('Updating all client configs...');
  Object.entries(clientConfigs).forEach(([client, configPath]) => {
    if (isBaseConfig(configPath)) {
      debugLog(`Skipping base config: ${configPath}`);
      return;
    }
    try {
      if (!fs.existsSync(configPath)) {
        debugLog(`Config file not found: ${configPath}`);
        return;
      }
      debugLog(`Updating config: ${configPath}`);
      const raw = fs.readFileSync(configPath, 'utf8');
      const config: McpConfig = JSON.parse(raw);
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[serverName] = serverConfig;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      debugLog(`Successfully updated ${client} config with server: ${serverName}`);
    } catch (error) {
      debugLog(`Error updating ${client} config: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

// Remove server from all client configs (uninstall)
export function removeFromAllClientConfigs(officialServerName: string) {
  // Note: officialServerName is expected to be the exact name from package.json
  debugLog(`Removing server with official name "${officialServerName}" from all client configs...`);
  Object.entries(clientConfigs).forEach(([client, configPath]) => {
    if (isBaseConfig(configPath)) {
      debugLog(`Skipping base config: ${configPath}`);
      return;
    }
    try {
      if (!fs.existsSync(configPath)) {
        debugLog(`Config file not found: ${configPath}`);
        return;
      }
      debugLog(`Processing config: ${configPath}`);
      const raw = fs.readFileSync(configPath, 'utf8');
      const config: McpConfig = JSON.parse(raw);
      if (!config.mcpServers) {
        debugLog(`No mcpServers in config: ${configPath}`);
        return;
      }
      // Use exact match with the official server name
      if (config.mcpServers[officialServerName]) {
        debugLog(`Removing config entry: ${officialServerName} from ${client}`);
        delete config.mcpServers[officialServerName];
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        debugLog(`Successfully removed ${officialServerName} from ${client} config`);
      } else {
        debugLog(`Server ${officialServerName} not found in ${client} config`);
      }
    } catch (error) {
      debugLog(`Error removing server from ${client} config: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}