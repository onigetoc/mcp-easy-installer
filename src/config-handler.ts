import * as path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { debugLog } from './logger.js';

export class ConfigHandler {
  constructor(private readonly mcpConfigPath: string) {}

  /**
   * Update MCP configuration file with new server entry
   */
  updateMcpConfig(serverName: string, config: any): void {
    debugLog(`Updating MCP config at: ${this.mcpConfigPath}`);

    try {
      // Read existing config or create new one
      let fullConfig: any;
      try {
        const existingConfig = readFileSync(this.mcpConfigPath, 'utf8');
        fullConfig = JSON.parse(existingConfig);
        debugLog('Successfully read existing config');
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          debugLog('No existing config found, creating new one');
          fullConfig = { mcpServers: {} };
        } else {
          throw error;
        }
      }

      // Make sure mcpServers exists
      if (!fullConfig.mcpServers) {
        fullConfig.mcpServers = {};
      }

      // Format Windows paths with exactly two backslashes
      const formattedArgs = config.args?.map((arg: string) => {
        if (typeof arg === 'string') {
          return arg.replace(/\\\\/g, '\\');
        }
        return arg;
      }) ?? [];

      // Add server config
      const serverConfig: any = {
        command: config.command,
        args: formattedArgs
      };

      // Add env if present
      if (config.env) {
        serverConfig.env = config.env;
      }

      // Update config object
      fullConfig.mcpServers[serverName] = serverConfig;

      // Custom JSON stringifier to handle backslashes
      const jsonString = JSON.stringify(fullConfig, (key, value) => {
        if (typeof value === 'string') {
          return value.replace(/\\\\/g, '\\');
        }
        return value;
      }, 2);

      // Write to file synchronously
      writeFileSync(this.mcpConfigPath, jsonString, 'utf8');

      debugLog('Successfully updated config file');
      debugLog(`Added/Updated server config: ${JSON.stringify(serverConfig, null, 2)}`);

    } catch (error) {
      debugLog(`Failed to update config: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to update MCP config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  generateNodeMcpConfig(jsFilePath: string, serverName: string, env?: { [key: string]: string } | null): string {
    debugLog(`Generating Node.js MCP config for ${serverName}`);
    const formattedPath = process.platform === 'win32'
      ? jsFilePath.replace(/\\/g, '\\\\')
      : jsFilePath;

    const serverConfig: any = {
      command: "node",
      args: [formattedPath],
    };

    if (env && typeof env === 'object' && Object.keys(env).length > 0) {
      debugLog('Found environment variables in README:');
      Object.entries(env).forEach(([key, value]) => {
        debugLog(`  ${key} = ${value}`);
      });
      serverConfig.env = env;
    }

    const config = {
      [serverName]: serverConfig,
    };

    const jsonString = JSON.stringify(config, (key, value) => {
      if (typeof value === 'string' && process.platform === 'win32') {
        return value.replace(/\\\\/g, '\\');
      }
      return value;
    }, 2);

    debugLog(`Generated Node.js config:\n${jsonString}`);
    return jsonString;
  }

  generatePythonMcpConfig(scriptPath: string, serverName: string, env?: { [key: string]: string } | null): string {
    debugLog(`Generating Python MCP config for ${serverName}`);
    const formattedPath = process.platform === 'win32'
      ? scriptPath.replace(/\\/g, '\\\\')
      : scriptPath;

    const serverConfig: any = {
      command: "uv",
      args: ["run", formattedPath],
    };

    if (env && typeof env === 'object' && Object.keys(env).length > 0) {
      debugLog('Found environment variables in README:');
      Object.entries(env).forEach(([key, value]) => {
        debugLog(`  ${key} = ${value}`);
      });
      serverConfig.env = env;
    }

    const config = {
      [serverName]: serverConfig,  
    };

    const jsonString = JSON.stringify(config, (key, value) => {
      if (typeof value === 'string' && process.platform === 'win32') {
        return value.replace(/\\\\/g, '\\');
      }
      return value;
    }, 2);

    debugLog(`Generated Python config:\n${jsonString}`);
    return jsonString;
  }
}