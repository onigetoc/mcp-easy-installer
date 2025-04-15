/**
 * Custom debug logger that doesn't interfere with MCP JSON output
 */
export function debugLog(message: string) {
  process.stderr.write(`DEBUG: ${message}\n`);
}