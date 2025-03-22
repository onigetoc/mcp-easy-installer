# MCP Repair Fix MCP server

```json
{
  "mcpServers": {
    "repair-tool": {
      "command": "node",
      "args": ["C:\\Users\\LENOVO\\APPS\\0-MCP\\mcp-generator\\build\\index.js"],
      "enabled": true
    }
  }
}
```

## mcp repair

Quand c'est un projet typescript.
Le package.json doit avoir 
```javascript
"type": "module",
```
si non, on peut mettre mais c'est pas obligé.
```javascript
"type": "commonjs",
```