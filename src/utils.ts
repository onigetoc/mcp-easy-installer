import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Ensures the Flowvibe/MCP directory structure exists and initializes mcp_configs.json
 */
/**
 * Creates the Flowvibe MCP directory structure and initializes config file
 * @returns {Object} The paths to created directories
 */
export function ensureFlowvibeMcpStructure(): { basePath: string; configPath: string } {
  // Get user's home directory
  const homeDir = os.homedir();

  let basePath: string;
  const oneDrivePath = path.join(homeDir, 'OneDrive', 'Documents');
  const documentsPath = path.join(homeDir, 'Documents');

  // Check OneDrive first if on Windows
  if (process.platform === 'win32' && fs.existsSync(oneDrivePath)) {
    basePath = path.join(oneDrivePath, 'Flowvibe', 'MCP');
  }
  // Check regular Documents folder
  else if (fs.existsSync(documentsPath)) {
    basePath = path.join(documentsPath, 'Flowvibe', 'MCP');
  }
  // Fallback to home directory
  else {
    basePath = path.join(homeDir, 'Documents', 'Flowvibe', 'MCP');
  }

  // Create directory structure if it doesn't exist
  fs.mkdirSync(basePath, { recursive: true });

  // Initialize mcp_configs.json if it doesn't exist
  const configPath = path.join(basePath, 'mcp_configs.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {} }, null, 2));
  }

  return { basePath, configPath };
}