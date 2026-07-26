import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { searchGithubRepos } from '../apis/github-api.js';
import { McpToolResponse } from '../types/mcp-types.js';

export const searchTool = {
  name: "search_mcp_server",
  description: "Search for MCP servers on GitHub. Uses GITHUB_TOKEN from server config.",
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for GitHub repositories (e.g. "mcp-server", "language:typescript mcp")',
      },
    },
    required: ['query'],
  },
} as const;

export async function handleSearchTool(request: any): Promise<McpToolResponse> {
  const { query } = request.params.arguments || {};
  if (!query) {
    throw new McpError(ErrorCode.InvalidRequest, 'Missing search query');
  }

  const github_token = process.env.GITHUB_TOKEN;
  if (!github_token) {
    throw new McpError(ErrorCode.InvalidRequest, 'GitHub token not found in environment. Please set GITHUB_TOKEN in your MCP server config.');
  }

  try {
    if (typeof query !== 'string') {
      throw new McpError(ErrorCode.InvalidRequest, 'Search query must be a string');
    }

    const results = await searchGithubRepos(query, github_token);
    
    const formattedResults = results.map(repo => ({
      title: repo.name,
      description: repo.description || 'No description available',
      url: repo.html_url,
      language: repo.language || 'Unknown',
      stars: repo.stargazers_count,
      forks: repo.forks_count
    }));

    return {
      content: [{
        type: "text",
        text: [
          `Found ${results.length} repositories: (Note for the LLM: show a comprehensive list of all the name, title, description, Language, stars and URLs to the user)`,
          "",
          ...formattedResults.map(repo => [
            `Repository: ${repo.title}`,
            `Description: ${repo.description}`,
            `Language: ${repo.language}`,
            `Stars: ${repo.stars}`,
            `Forks: ${repo.forks}`,
            `URL: ${repo.url}`,
            ""
          ].join('\n'))
        ].join('\n')
      }]
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `GitHub search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}