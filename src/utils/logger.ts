/**
 * Custom debug logger that doesn't interfere with MCP JSON output
 */
export function debugLog(message: string, data?: any) {
  if (data) {
    process.stderr.write(`DEBUG: ${message}: ${JSON.stringify(data)}\n`);
  } else {
    process.stderr.write(`DEBUG: ${message}\n`);
  }
}