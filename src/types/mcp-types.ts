// MCP-specific types for better type safety

export interface McpToolRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface McpToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

// More flexible type for handlers to work with MCP SDK
export type ToolHandler = (request: any) => Promise<McpToolResponse>;