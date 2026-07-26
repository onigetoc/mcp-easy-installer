#!/usr/bin/env node

// Check if running in CLI mode or MCP server mode
const isCliMode = process.argv.length > 2 && process.argv[2] !== undefined;

if (isCliMode) {
  // CLI Mode - handle command line arguments
  import('./cli/cli-handler.js');
} else {
  // MCP Server Mode
  import('./server/mcp-server.js');
}