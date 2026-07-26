import { z } from "zod";

// Package.json schema
export const PackageJsonSchema = z.object({
  name: z.string(),
  main: z.string().optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  type: z.string().optional(),
  bin: z.union([z.string(), z.record(z.string(), z.string())]).optional()
});

// PyProject.toml schema
export const PyProjectTomlSchema = z.object({
  project: z.object({
    scripts: z.record(z.string(), z.string()).optional()
  }).optional(),
  tool: z.object({
    poetry: z.object({
      scripts: z.record(z.string(), z.string()).optional()
    }).optional()
  }).optional()
});

// MCP Configuration schema (passthrough to preserve unknown keys like "type", "disabled", "autoApprove")
export const ServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  enabled: z.boolean().optional(),
  disabled: z.boolean().optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional()
}).passthrough();

export const McpConfigSchema = z.object({
  mcpServers: z.record(z.string(), ServerConfigSchema)
}).passthrough();

// Install result schema
export const InstallResultSchema = z.object({
  serverName: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  status: z.string().optional(),
  message: z.string().optional(),
  type: z.union([z.literal('nodejs'), z.literal('python-pyproject'), z.literal('python-requirements'), z.literal(null)]),
  fullPath: z.string(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional()
});

// Export types from schemas
export type PackageJson = z.infer<typeof PackageJsonSchema>;
export type PyProjectToml = z.infer<typeof PyProjectTomlSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type McpConfig = z.infer<typeof McpConfigSchema>;
export type InstallResult = z.infer<typeof InstallResultSchema>;
