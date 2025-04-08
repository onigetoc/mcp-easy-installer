# MCP Generator

This project is a tool for generating Model Context Protocol (MCP) components.

## Installation

To install the MCP Generator, run:

```bash
npm install
```

## Usage

Test MPC server in Terminal:

```bash
bun start -- broken mcp serve vague name
npm start -- broken mcp serve vague name
```

To use the MCP Generator, run:

```bash
npm run build
```

<!--
// Generate using?:
const config = JSON.stringify({ name: 'mcp-install-repair-tool', command: 'npx', args: ["-y", "@onigetoc/mcp-install-repair-tool"] });
const urlForWebsites = `vscode:mcp/install?${encodeURIComponent(config)}`;
// Github markdown does not allow linking to `vscode:` directly, so you can use our redirect:
const urlForGithub = `https://insiders.vscode.dev/redirect?url=${encodeURIComponent(urlForWebsites)}`;
-->

## Example config
```json
{
  "mcpServers": {
    "mcp-install-repair-tool": {
        "command": "node",
        "args": [
        "C:\\Users\\LENOVO\\APPS\\0-MCP\\mcp-fix-installer\\build\\index.js"],
        "env": {"GITHUB_TOKEN":"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"},
        "enabled": false,
        "disabled": true
    }
  }
}
```

## Installation Flow

```mermaid
graph TD
    A[Parse User Input] --> B{URL Type?}
    B -->|GitHub shorthand| C[Construct full URL]
    B -->|Full URL| D[Clone Repository]
    C --> D
    D --> E[Install Dependencies]
    E --> F[Build Project]
    F --> G[Locate index.js]
    G --> H[Generate MCP Config]
    H --> I[Update Settings]
```

This will generate the MCP components in the `build` directory.

## Contributing

To contribute to the MCP Generator, please follow these steps:

1.  Fork the repository.
2.  Create a new branch.
3.  Make your changes.
4.  Submit a pull request.

### WHere is the MCP bin folder on Windows?
If bin javascript code for a MPC Server in index.js
```javascript
#!/usr/bin/env node
```
Main bin folder for modelcontextprotocol
```
C:\Users\USERNAME\AppData\Roaming\npm\node_modules\@modelcontextprotocol
```
Ex: fileserver become server-fileserver
```
C:\Users\USERNAME\AppData\Roaming\npm\node_modules\@modelcontextprotocol\server-fileserver
```
Usually the index.js file will be:
```
C:\Users\USERNAME\AppData\Roaming\npm\node_modules\@modelcontextprotocol\server-fileserver\dist\index.js
```