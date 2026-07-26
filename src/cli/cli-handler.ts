#!/usr/bin/env node

import { ensureFlowvibeMcpStructure } from '../utils/file-system.js';
import { installMcpServer } from '../services/server-installer.js';
import { uninstallServer } from '../services/uninstall-manager.js';
import { searchGithubRepos } from '../apis/github-api.js';

// Handle CLI mode
const command = process.argv[2];
const { basePath } = ensureFlowvibeMcpStructure();
const githubToken = process.env.GITHUB_TOKEN;

if (command === 'install' && process.argv[3]) {
  installMcpServer(process.argv[3])
    .then(result => {
      const serverConfig = {
        config: {
          [(result.serverName || "unknown")]: {
            command: result.command,
            args: result.args,
            enabled: true,
            env: result.env || {}
          }
        },
        status: "success"
      };
      console.log(JSON.stringify(serverConfig));
      process.exit(0);
    })
    .catch(error => {
      const errorOutput = {
        error: error instanceof Error ? error.message : String(error),
        status: "error"
      };
      console.log(JSON.stringify(errorOutput));
      process.exit(1);
    });
} else if (command === 'search' && process.argv[3]) {
  if (!githubToken) {
    const errorOutput = {
      error: "GITHUB_TOKEN not found in environment. Add to mcp_configs.json: { \"env\": { \"GITHUB_TOKEN\": \"your_token\" } }",
      status: "error"
    };
    console.log(JSON.stringify(errorOutput));
    process.exit(1);
  }
  
  searchGithubRepos(process.argv[3], githubToken)
    .then(results => {
      const output = {
        results: results.map(repo => ({
          name: repo.name,
          description: repo.description || 'No description',
          language: repo.language || 'Unknown',
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          url: repo.html_url
        })),
        status: "success"
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    })
    .catch(error => {
      const errorOutput = {
        error: error instanceof Error ? error.message : String(error),
        status: "error"
      };
      console.log(JSON.stringify(errorOutput));
      process.exit(1);
    });
} else if (command === 'uninstall' && process.argv[3]) {
  uninstallServer(process.argv[3], basePath)
    .then(result => {
      console.log(JSON.stringify({ result, status: "success" }));
      process.exit(0);
    })
    .catch(error => {
      console.log(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        status: "error"
      }));
      process.exit(1);
    });
} else {
  const usageOutput = {
    error: "Invalid command",
    usage: {
      install: "npm start install <repo-url>      Install new MCP server",
      uninstall: "npm start uninstall <server-name> Uninstall MCP server",
      search: "npm start search <query>          Search for MCP servers on GitHub"
    },
    note: "For search, set GITHUB_TOKEN in mcp_configs.json",
    status: "error"
  };
  console.log(JSON.stringify(usageOutput));
  process.exit(1);
}