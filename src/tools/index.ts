// Export all tools
export { installTool, handleInstallTool } from './install-tool.js';
export { searchTool, handleSearchTool } from './search-tool.js';
export { uninstallTool, handleUninstallTool } from './uninstall-tool.js';
export { repairTool, handleRepairTool } from './repair-tool.js';

// Import for local use
import { installTool, handleInstallTool } from './install-tool.js';
import { searchTool, handleSearchTool } from './search-tool.js';
import { uninstallTool, handleUninstallTool } from './uninstall-tool.js';
import { repairTool, handleRepairTool } from './repair-tool.js';

// Tool registry for easy access
export const tools = [
  installTool,
  searchTool,
  uninstallTool,
  repairTool
];

// Import types
import { ToolHandler } from '../types/mcp-types.js';

// Handler registry
export const toolHandlers: Record<string, ToolHandler> = {
  'install_mcp_server': handleInstallTool,
  'search_mcp_server': handleSearchTool,
  'uninstall_mcp_server': handleUninstallTool,
  'repair_mcp_server': handleRepairTool,
};