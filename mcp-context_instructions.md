[comment]: #

# Introduction

## Get started with the Model Context Protocol (MCP)

### Java SDK released! Check out what else is new.

MCP is an open protocol that standardizes how applications provide context to LLMs. Think of MCP like a USB-C port for AI applications. Just as USB-C provides a standardized way to connect your devices to various peripherals and accessories, MCP provides a standardized way to connect AI models to different data sources and tools.

## Why MCP?

MCP helps you build agents and complex workflows on top of LLMs. LLMs frequently need to integrate with data and tools, and MCP provides:

- A growing list of pre-built integrations that your LLM can directly plug into
- The flexibility to switch between LLM providers and vendors
- Best practices for securing your data within your infrastructure

## General architecture

At its core, MCP follows a client-server architecture where a host application can connect to multiple servers:

+-----------------------------------------------------------------------+
|                               Your Computer                           |
+-----------------------------------------------------------------------+
|                                                                       |
|   +-----------------------+     MCP Protocol   +-----------------+    |
|   | Host with MCP Client  |------------------->| MCP Server A    |    |
|   | (Claude, IDEs, Tools) |                    |                 |    |
|   +-----------------------+                    +-----------------+    |
|             ^                                          |              |
|             |                                          |              |
|             |                                          v              |
|             |                                  +-------------+        |
|             |                                  | Local Data  |        |
|             |                                  | Source A    |        |
|             |                                  +-------------+        |
|             |                                                         |             |
|   +-----------------------+     MCP Protocol    +-----------------+   |
|   | Host with MCP Client  |-------------------->| MCP Server B    |   |
|   | (Claude, IDEs, Tools) |                     |                 |   |
|   +-----------------------+                     +-----------------+   |
|             ^                                          |              |
|             |                                          |              |
|             |                                          v              |
|             |                                  +-------------+        |
|             |                                  | Local Data  |        |
|             |                                  | Source B    |        |
|             |                                  +-------------+        |
|             |                                                         |              |
|   +-----------------------+     MCP Protocol   +-----------------+    |
|   | Host with MCP Client  |------------------->| MCP Server C    |    |
|   | (Claude, IDEs, Tools) |                    |                 |    |
|   +-----------------------+                    +-----------------+    |
|                                                   | Web APIs |        |
|                                                        v              |
+--------------------------------------------------------+--------------+
                                                         |
                                                         | Internet
                                                         |
                                                 +-------------+
                                                 | Remote      |
                                                 | Service C   |
                                                 +-------------+

```
Internet

Your Computer

MCP Protocol
MCP Protocol
MCP Protocol

Web APIs

Host with MCP Client
(Claude, IDEs, Tools)

MCP Server A
MCP Server B
MCP Server C

Local
Data Source A

Local
Data Source B

Remote
Service C
```

### Components

- **MCP Hosts**: Programs like Claude Desktop, IDEs, or AI tools that want to access data through MCP
- **MCP Clients**: Protocol clients that maintain 1:1 connections with servers
- **MCP Servers**: Lightweight programs that each expose specific capabilities through the standardized Model Context Protocol
- **Local Data Sources**: Your computer’s files, databases, and services that MCP servers can securely access
- **Remote Services**: External systems available over the internet (e.g., through APIs) that MCP servers can connect to



# Introducing the Model Context Protocol

Model Context Protocol (MCP), a new standard for connecting AI assistants to the systems where data lives, including content repositories, business tools, and development environments. Its aim is to help frontier models produce better, more relevant responses.

Model Context Protocol
The Model Context Protocol is an open standard that enables developers to build secure, two-way connections between their data sources and AI-powered tools. The architecture is straightforward: developers can either expose their data through MCP servers or build AI applications (MCP clients) that connect to these servers.

Today, we're introducing three major components of the Model Context Protocol for developers:

The Model Context Protocol specification and SDKs
Local MCP server support in the Claude and others Desktop apps
An open-source repository of MCP servers
Claude 3.5 Sonnet is adept at quickly building MCP server implementations, making it easy for organizations and individuals to rapidly connect their most important datasets with a range of AI-powered tools. To help developers start exploring, we’re sharing pre-built MCP servers for popular enterprise systems like Google Drive, Slack, GitHub, Git, Postgres, and Puppeteer.

Early adopters like Block and Apollo have integrated MCP into their systems, while development tools companies including Zed, Replit, Codeium, and Sourcegraph are working with MCP to enhance their platforms—enabling AI agents to better retrieve relevant information to further understand the context around a coding task and produce more nuanced and functional code with fewer attempts.

"At Block, open source is more than a development model—it’s the foundation of our work and a commitment to creating technology that drives meaningful change and serves as a public good for all,” said Dhanji R. Prasanna, Chief Technology Officer at Block. “Open technologies like the Model Context Protocol are the bridges that connect AI to real-world applications, ensuring innovation is accessible, transparent, and rooted in collaboration. We are excited to partner on a protocol and use it to build agentic systems, which remove the burden of the mechanical so people can focus on the creative.”

Instead of maintaining separate connectors for each data source, developers can now build against a standard protocol. As the ecosystem matures, AI systems will maintain context as they move between different tools and datasets, replacing today's fragmented integrations with a more sustainable architecture.

Getting started
Developers can start building and testing MCP connectors today. Existing Claude for Work customers can begin testing MCP servers locally, connecting Claude to internal systems and datasets. We'll soon provide developer toolkits for deploying remote production MCP servers that can serve your entire Claude for Work organization.

The Model Context Protocol (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. Whether you’re building an AI-powered IDE, enhancing a chat interface, or creating custom AI workflows, MCP provides a standardized way to connect LLMs with the context they need.

# Quickstart

Get started with MCP in less than 5 minutes

MCP is a protocol that enables secure connections between host applications, such as Claude Desktop, and local services. In this quickstart guide, you’ll learn how to:

- Set up a local SQLite database
- Connect Claude Desktop to it through MCP
- Query and analyze your data securely

_While this guide focuses on using Claude Desktop as an example MCP host, the protocol is open and can be integrated by any application. IDEs, AI tools, and other software can all use MCP to connect to local integrations in a standardized way._

_Claude Desktop’s MCP support is currently in developer preview and only supports connecting to local MCP servers running on your machine. Remote MCP connections are not yet supported. This integration is only available in the Claude Desktop app, not the Claude web interface (claude.ai)._

## How MCP works

MCP (Model Context Protocol) is an open protocol that enables secure, controlled interactions between AI applications and local or remote resources. Let’s break down how it works, then look at how we’ll use it in this guide.

### General Architecture

At its core, MCP follows a client-server architecture where a host application can connect to multiple servers:

- **MCP Hosts:** Programs like Claude Desktop, VS Code extension (Cline, Roo-Code), IDEs, or AI tools that want to access resources through MCP
- **MCP Clients:** Protocol clients that maintain 1:1 connections with servers
- **MCP Servers:** Lightweight programs that each expose specific capabilities through the standardized Model Context Protocol
- **Local Resources:** Your computer’s resources (databases, files, services) that MCP servers can securely access
- **Remote Resources:** Resources available over the internet (e.g., through APIs) that MCP servers can connect to

### In This Guide

For this quickstart, we’ll implement a focused example using SQLite:

1. Claude Desktop, VS Code extension Cline, Roo Code and many more acts as our MCP client
2. A SQLite MCP Server provides secure database access
3. Your local SQLite database stores the actual data

The communication between the SQLite MCP server and your local SQLite database happens entirely on your machine—your SQLite database is not exposed to the internet. The Model Context Protocol ensures that Claude Desktop can only perform approved database operations through well-defined interfaces. This gives you a secure way to let Claude analyze and interact with your local data while maintaining complete control over what it can access.

## Prerequisites

- macOS or Windows
- The latest version of Claude Desktop installed
- Linux uv 0.4.18 or higher (uv --version to check)
- Nodejs 16 or higher (node -v to check)
- Git (git --version to check)
- filesystem (--version to check)


## Demo example with multiple tools call for a mcp filesystem-server
using tools:

```javascript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create an MCP server
const server = new McpServer({
  name: "Demo",
  version: "1.0.0"
});

// Add an addition tool
server.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

```

## Example simple 2 
Simple echo text from user like "Echo back Hello world please"

```javascript
#!/usr/bin/env node

/**
 * A simple MCP echo server that repeats back whatever it is prompted for testing.
 * It implements a single tool that echoes back the input message.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Create an MCP server with capabilities for tools (to echo messages).
 */
const server = new Server(
  {
    name: "echo-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handler that lists available tools.
 * Exposes a single "echo" tool that echoes back the input message.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echoes back the input message",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo back"
            }
          },
          required: ["message"]
        }
      }
    ]
  };
});

/**
 * Handler for the echo tool.
 * Simply returns the input message.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "echo": {
      const message = String(request.params.arguments?.message || "");
      
      if (!message) {
        return {
          content: [{
            type: "text",
            text: "You didn't provide a message to echo!"
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: message
        }]
      };
    }

    default:
      throw new Error("Unknown tool");
  }
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Echo MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

## Example medium 3

```javascript
#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const WEB_SEARCH_TOOL: Tool = {
  name: "brave_web_search",
  description:
    "Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. " +
    "Use this for broad information gathering, recent events, or when you need diverse web sources. " +
    "Supports pagination, content filtering, and freshness controls. " +
    "Maximum 20 results per request, with offset for pagination. ",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (max 400 chars, 50 words)"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 10)",
        default: 10
      },
      offset: {
        type: "number",
        description: "Pagination offset (max 9, default 0)",
        default: 0
      },
    },
    required: ["query"],
  },
};

const LOCAL_SEARCH_TOOL: Tool = {
  name: "brave_local_search",
  description:
    "Searches for local businesses and places using Brave's Local Search API. " +
    "Best for queries related to physical locations, businesses, restaurants, services, etc. " +
    "Returns detailed information including:\n" +
    "- Business names and addresses\n" +
    "- Ratings and review counts\n" +
    "- Phone numbers and opening hours\n" +
    "Use this when the query implies 'near me' or mentions specific locations. " +
    "Automatically falls back to web search if no local results are found.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Local search query (e.g. 'pizza near Central Park')"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 5)",
        default: 5
      },
    },
    required: ["query"]
  }
};

// Server implementation
const server = new Server(
  {
    name: "example-servers/brave-search",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY!;
if (!BRAVE_API_KEY) {
  console.error("Error: BRAVE_API_KEY environment variable is required");
  process.exit(1);
}

const RATE_LIMIT = {
  perSecond: 1,
  perMonth: 15000
};

let requestCount = {
  second: 0,
  month: 0,
  lastReset: Date.now()
};

function checkRateLimit() {
  const now = Date.now();
  if (now - requestCount.lastReset > 1000) {
    requestCount.second = 0;
    requestCount.lastReset = now;
  }
  if (requestCount.second >= RATE_LIMIT.perSecond ||
    requestCount.month >= RATE_LIMIT.perMonth) {
    throw new Error('Rate limit exceeded');
  }
  requestCount.second++;
  requestCount.month++;
}

interface BraveWeb {
  web?: {
    results?: Array<{
      title: string;
      description: string;
      url: string;
      language?: string;
      published?: string;
      rank?: number;
    }>;
  };
  locations?: {
    results?: Array<{
      id: string; // Required by API
      title?: string;
    }>;
  };
}

interface BraveLocation {
  id: string;
  name: string;
  address: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  rating?: {
    ratingValue?: number;
    ratingCount?: number;
  };
  openingHours?: string[];
  priceRange?: string;
}

interface BravePoiResponse {
  results: BraveLocation[];
}

interface BraveDescription {
  descriptions: {[id: string]: string};
}

function isBraveWebSearchArgs(args: unknown): args is { query: string; count?: number } {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

function isBraveLocalSearchArgs(args: unknown): args is { query: string; count?: number } {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

async function performWebSearch(query: string, count: number = 10, offset: number = 0) {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', Math.min(count, 20).toString()); // API limit
  url.searchParams.set('offset', offset.toString());

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const data = await response.json() as BraveWeb;

  // Extract just web results
  const results = (data.web?.results || []).map(result => ({
    title: result.title || '',
    description: result.description || '',
    url: result.url || ''
  }));

  return results.map(r =>
    `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}`
  ).join('\n\n');
}

async function performLocalSearch(query: string, count: number = 5) {
  checkRateLimit();
  // Initial search to get location IDs
  const webUrl = new URL('https://api.search.brave.com/res/v1/web/search');
  webUrl.searchParams.set('q', query);
  webUrl.searchParams.set('search_lang', 'en');
  webUrl.searchParams.set('result_filter', 'locations');
  webUrl.searchParams.set('count', Math.min(count, 20).toString());

  const webResponse = await fetch(webUrl, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!webResponse.ok) {
    throw new Error(`Brave API error: ${webResponse.status} ${webResponse.statusText}\n${await webResponse.text()}`);
  }

  const webData = await webResponse.json() as BraveWeb;
  const locationIds = webData.locations?.results?.filter((r): r is {id: string; title?: string} => r.id != null).map(r => r.id) || [];

  if (locationIds.length === 0) {
    return performWebSearch(query, count); // Fallback to web search
  }

  // Get POI details and descriptions in parallel
  const [poisData, descriptionsData] = await Promise.all([
    getPoisData(locationIds),
    getDescriptionsData(locationIds)
  ]);

  return formatLocalResults(poisData, descriptionsData);
}

async function getPoisData(ids: string[]): Promise<BravePoiResponse> {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/local/pois');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const poisResponse = await response.json() as BravePoiResponse;
  return poisResponse;
}

async function getDescriptionsData(ids: string[]): Promise<BraveDescription> {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/local/descriptions');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const descriptionsData = await response.json() as BraveDescription;
  return descriptionsData;
}

function formatLocalResults(poisData: BravePoiResponse, descData: BraveDescription): string {
  return (poisData.results || []).map(poi => {
    const address = [
      poi.address?.streetAddress ?? '',
      poi.address?.addressLocality ?? '',
      poi.address?.addressRegion ?? '',
      poi.address?.postalCode ?? ''
    ].filter(part => part !== '').join(', ') || 'N/A';

    return `Name: ${poi.name}
Address: ${address}
Phone: ${poi.phone || 'N/A'}
Rating: ${poi.rating?.ratingValue ?? 'N/A'} (${poi.rating?.ratingCount ?? 0} reviews)
Price Range: ${poi.priceRange || 'N/A'}
Hours: ${(poi.openingHours || []).join(', ') || 'N/A'}
Description: ${descData.descriptions[poi.id] || 'No description available'}
`;
  }).join('\n---\n') || 'No local results found';
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [WEB_SEARCH_TOOL, LOCAL_SEARCH_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    switch (name) {
      case "brave_web_search": {
        if (!isBraveWebSearchArgs(args)) {
          throw new Error("Invalid arguments for brave_web_search");
        }
        const { query, count = 10 } = args;
        const results = await performWebSearch(query, count);
        return {
          content: [{ type: "text", text: results }],
          isError: false,
        };
      }

      case "brave_local_search": {
        if (!isBraveLocalSearchArgs(args)) {
          throw new Error("Invalid arguments for brave_local_search");
        }
        const { query, count = 5 } = args;
        const results = await performLocalSearch(query, count);
        return {
          content: [{ type: "text", text: results }],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Brave Search MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
```

Add this configuration (replace YOUR_USERNAME with your actual username):

### Windows

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\LENOVO\\APPS\\Desktop",
        "\\path\\to\\other\\allowed\\dir"
      ]
    }
  }
}
```

## Example 4 with an API.

```javascript
#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const WEB_SEARCH_TOOL: Tool = {
  name: "brave_web_search",
  description:
    "Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. " +
    "Use this for broad information gathering, recent events, or when you need diverse web sources. " +
    "Supports pagination, content filtering, and freshness controls. " +
    "Maximum 20 results per request, with offset for pagination. ",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (max 400 chars, 50 words)"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 10)",
        default: 10
      },
      offset: {
        type: "number",
        description: "Pagination offset (max 9, default 0)",
        default: 0
      },
    },
    required: ["query"],
  },
};

const LOCAL_SEARCH_TOOL: Tool = {
  name: "brave_local_search",
  description:
    "Searches for local businesses and places using Brave's Local Search API. " +
    "Best for queries related to physical locations, businesses, restaurants, services, etc. " +
    "Returns detailed information including:\n" +
    "- Business names and addresses\n" +
    "- Ratings and review counts\n" +
    "- Phone numbers and opening hours\n" +
    "Use this when the query implies 'near me' or mentions specific locations. " +
    "Automatically falls back to web search if no local results are found.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Local search query (e.g. 'pizza near Central Park')"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 5)",
        default: 5
      },
    },
    required: ["query"]
  }
};

// Server implementation
const server = new Server(
  {
    name: "example-servers/brave-search",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY!;
if (!BRAVE_API_KEY) {
  console.error("Error: BRAVE_API_KEY environment variable is required");
  process.exit(1);
}

const RATE_LIMIT = {
  perSecond: 1,
  perMonth: 15000
};

let requestCount = {
  second: 0,
  month: 0,
  lastReset: Date.now()
};

function checkRateLimit() {
  const now = Date.now();
  if (now - requestCount.lastReset > 1000) {
    requestCount.second = 0;
    requestCount.lastReset = now;
  }
  if (requestCount.second >= RATE_LIMIT.perSecond ||
    requestCount.month >= RATE_LIMIT.perMonth) {
    throw new Error('Rate limit exceeded');
  }
  requestCount.second++;
  requestCount.month++;
}

interface BraveWeb {
  web?: {
    results?: Array<{
      title: string;
      description: string;
      url: string;
      language?: string;
      published?: string;
      rank?: number;
    }>;
  };
  locations?: {
    results?: Array<{
      id: string; // Required by API
      title?: string;
    }>;
  };
}

interface BraveLocation {
  id: string;
  name: string;
  address: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  rating?: {
    ratingValue?: number;
    ratingCount?: number;
  };
  openingHours?: string[];
  priceRange?: string;
}

interface BravePoiResponse {
  results: BraveLocation[];
}

interface BraveDescription {
  descriptions: {[id: string]: string};
}

function isBraveWebSearchArgs(args: unknown): args is { query: string; count?: number } {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

function isBraveLocalSearchArgs(args: unknown): args is { query: string; count?: number } {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

async function performWebSearch(query: string, count: number = 10, offset: number = 0) {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', Math.min(count, 20).toString()); // API limit
  url.searchParams.set('offset', offset.toString());

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const data = await response.json() as BraveWeb;

  // Extract just web results
  const results = (data.web?.results || []).map(result => ({
    title: result.title || '',
    description: result.description || '',
    url: result.url || ''
  }));

  return results.map(r =>
    `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}`
  ).join('\n\n');
}

async function performLocalSearch(query: string, count: number = 5) {
  checkRateLimit();
  // Initial search to get location IDs
  const webUrl = new URL('https://api.search.brave.com/res/v1/web/search');
  webUrl.searchParams.set('q', query);
  webUrl.searchParams.set('search_lang', 'en');
  webUrl.searchParams.set('result_filter', 'locations');
  webUrl.searchParams.set('count', Math.min(count, 20).toString());

  const webResponse = await fetch(webUrl, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!webResponse.ok) {
    throw new Error(`Brave API error: ${webResponse.status} ${webResponse.statusText}\n${await webResponse.text()}`);
  }

  const webData = await webResponse.json() as BraveWeb;
  const locationIds = webData.locations?.results?.filter((r): r is {id: string; title?: string} => r.id != null).map(r => r.id) || [];

  if (locationIds.length === 0) {
    return performWebSearch(query, count); // Fallback to web search
  }

  // Get POI details and descriptions in parallel
  const [poisData, descriptionsData] = await Promise.all([
    getPoisData(locationIds),
    getDescriptionsData(locationIds)
  ]);

  return formatLocalResults(poisData, descriptionsData);
}

async function getPoisData(ids: string[]): Promise<BravePoiResponse> {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/local/pois');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const poisResponse = await response.json() as BravePoiResponse;
  return poisResponse;
}

async function getDescriptionsData(ids: string[]): Promise<BraveDescription> {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/local/descriptions');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const descriptionsData = await response.json() as BraveDescription;
  return descriptionsData;
}

function formatLocalResults(poisData: BravePoiResponse, descData: BraveDescription): string {
  return (poisData.results || []).map(poi => {
    const address = [
      poi.address?.streetAddress ?? '',
      poi.address?.addressLocality ?? '',
      poi.address?.addressRegion ?? '',
      poi.address?.postalCode ?? ''
    ].filter(part => part !== '').join(', ') || 'N/A';

    return `Name: ${poi.name}
Address: ${address}
Phone: ${poi.phone || 'N/A'}
Rating: ${poi.rating?.ratingValue ?? 'N/A'} (${poi.rating?.ratingCount ?? 0} reviews)
Price Range: ${poi.priceRange || 'N/A'}
Hours: ${(poi.openingHours || []).join(', ') || 'N/A'}
Description: ${descData.descriptions[poi.id] || 'No description available'}
`;
  }).join('\n---\n') || 'No local results found';
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [WEB_SEARCH_TOOL, LOCAL_SEARCH_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    switch (name) {
      case "brave_web_search": {
        if (!isBraveWebSearchArgs(args)) {
          throw new Error("Invalid arguments for brave_web_search");
        }
        const { query, count = 10 } = args;
        const results = await performWebSearch(query, count);
        return {
          content: [{ type: "text", text: results }],
          isError: false,
        };
      }

      case "brave_local_search": {
        if (!isBraveLocalSearchArgs(args)) {
          throw new Error("Invalid arguments for brave_local_search");
        }
        const { query, count = 5 } = args;
        const results = await performLocalSearch(query, count);
        return {
          content: [{ type: "text", text: results }],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Brave Search MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});

```

### Sometimes there are bugs with Windows and NPX

```json
{
  "mcpServers": {
    "wikipedia": {
      "command": "node",
      "args": [
        "C:\\Users\\USERNAME\\Documents\\Cline\\MCP\\wikipedia-server\\build\\index.js"
      ],
      "enabled": true
    }
  }
}
```

### Mac/Linux

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Desktop",
        "/path/to/other/allowed/dir"
      ]
    }
  }
}
```

### package.json starter

```json
{
  "name": "mcp-repair-tool",
  "version": "1.0.0",
  "description": "A tool to repair MCP server generator",
  "main": "index.js",
  "scripts": {
    "start": "node build/index.js",
    "build": "tsc",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "mcp",
    "repair",
    "typescript"
  ],
  "author": "@onigetoc",
  "license": "MIT",
  "dependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "ts-node": "^10.9.2"
  },
  "type": "module"
}
```


### Testing in the fake test-mcp server (fake mcp server with deliberate error the name test-mcp (folder name) with error for the test-mcp server)
```javascript
npm start -- test
```