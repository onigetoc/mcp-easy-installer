// Multi-client MCP config update logic
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type ServerConfig = {
  command: string;
  args: string[];
  enabled: boolean;
  disabled: boolean;
  autoApprove: string[];
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
  Object.entries(clientConfigs).forEach(([client, configPath]) => {
    if (isBaseConfig(configPath)) return; // skip base config
    try {
      if (!fs.existsSync(configPath)) return;
      const raw = fs.readFileSync(configPath, 'utf8');
      const config: McpConfig = JSON.parse(raw);
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[serverName] = serverConfig;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
      // skip on error, best-effort
    }
  });
}

// Remove server from all client configs (uninstall)
export function removeFromAllClientConfigs(serverName: string) {
  Object.entries(clientConfigs).forEach(([client, configPath]) => {
    if (isBaseConfig(configPath)) return; // skip base config
    try {
      if (!fs.existsSync(configPath)) return;
      const raw = fs.readFileSync(configPath, 'utf8');
      const config: McpConfig = JSON.parse(raw);
      if (!config.mcpServers) return;
      if (config.mcpServers[serverName]) {
        delete config.mcpServers[serverName];
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    } catch (e) {
      // skip on error, best-effort
    }
  });
}