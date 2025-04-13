# MCP Easy Installer
MCP easy installer is a robust mcp server with tools to search, install, configure, repair and uninstall MCP servers.

## Install & Repair Tools for MCP servers

MCP easy installer is a robust tool to search, install, configure, repair and uninstall MCP servers (Model Context Protocol). This utility is designed for developers and non-developers and end users, making it easy to set up and maintain MCP servers without technical expertise. Developers and system integrators can also use it to speed up their workflow and automate repetitive tasks. The tool streamlines setup, automates repairs, and ensures your MCP environment is always healthy.
This tool will automatically install and update all the necessary JSON configuration files for a wide range of applications, including Claude Desktop, Windsurf, Cursor, Roo Code, Cline, *GitHub Copilot, and more. It ensures seamless integration and up-to-date settings across your AI and developer tools ecosystem. 

---

## Features

- **Search & Discovery:** Find available MCP servers for installation.
- **Automated Installation:** Quickly install MCP servers from GitHub or local sources.
- **Repair Utility:** Detects and fixes common MCP server issues.
- **TypeScript Support:** Built with TypeScript for reliability and maintainability.
- **Comprehensive Logging:** Clear logs for every operation.
- **Cross-Platform:** Works on Windows, Linux, and Mac.

---

## Important Installation Note

**Do NOT use `npx` to install MCP servers with Node.js.**  
Instead, manually install all MCP servers in the following directory:

- **Windows:**
  ```
  C:\Users\USERNAME\Documents\Flowvibe\MCP\
  ```
- **Linux/Mac:**
  ```
  /home/USERNAME/Documents\Flowvibe\MCP/
  ```

Replace `USERNAME` with your actual user name on your system.

---

## VS Code - GitHub Copilot Integration Notes

**GitHub Copilot for VS Code is not directly supported by this tool.**

GitHub Copilot implements MCP in its own way with significant differences from other implementations. Due to these differences, GitHub Copilot is not included in this tool's supported applications.

* **Workaround:**
If you want to update MCP server connections for VS Code GitHub Copilot, install Claude Desktop, as GitHub Copilot connects to Claude Desktop's MCP servers. This provides an indirect way to enhance GitHub Copilot's capabilities through MCP.

---

## Python Integration Notes

**Python integration with MCP has some limitations.**

While this tool aims to provide seamless integration across multiple platforms and languages, Python support is currently imperfect and may require manual intervention in certain scenarios. Due to the diversity of Python environments, package managers, and project structures, automated installation and configuration may not work optimally in all cases.

**We welcome community contributions:**
- If you encounter issues with Python integration, please share your solutions in the issues section
- Consider forking this repository to implement improvements specific to Python environments
- Pull requests with enhancements to Python support are greatly appreciated

Our goal is to improve Python integration through collaborative development and user feedback.

---

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/mcp-install-repair-tool.git
cd mcp-install-repair-tool
npm install
```

#### Example Phrases
#### Community Question: GitHub Search Integration

We are considering whether to integrate a GitHub search feature directly into this tool. If integrated, providing a GitHub API token could be optional—without it, the Github search feature will not work (or may be restricted and limited), but all other tools and features will continue to function normally.

**We invite feedback from the community:**
Would you like to see GitHub search built in? Please share your thoughts and use cases in the issues or discussions section of this repository.


You can use natural language commands like:

- `Search for the fetch mcp server. (follow up prompt: install the third one)` May work with Brave or any others search tools with the Github or npmjs link.
- `Install this mcp server: https://www.npmjs.com/package/@modelcontextprotocol/server-brave-search` (NPMjs or Github repo url) or use Install <package>
- `Install this mcp server tavily-ai/tavily-mcp` Install <package>
- `Install mcp server with a Brave Github link search result.`
- `Repair the brave mcp server.`
- `Update all installed mcp servers.` Not working yet
- `Uninstall Brave` Will work and find it even if the name is "server-brave-search"

Note: Depending on LLM and the tool functions, it is perhaps preferable to often use these two words to trigger the MCP. Install, repair, fix, search `mcp servers.`

---

## Installation

### Option 1: Install with Git

```bash
# Clone the repository
git clone https://github.com/onigetoc/mcp-easy-installer.git

# Navigate to the directory
cd mcp-easy-installer

# Install dependencies
npm install

# Build the project
npm run build
```

### Option 2: Download and Install

1. Download the latest release from https://github.com/onigetoc/mcp-easy-installer
2. Extract the files to your preferred location
3. Open a terminal in the extracted directory
4. Run `npm install` to install dependencies
5. Run `npm run build` to compile the application for use with MCP clients

---

## Configuration

Configure your MCP servers in your settings file (The Github token is optional to search mcp server: Prevents rate limiting):


```json
{
  "mcpServers": {
    "mcp-easy-installer": {
      "command": "node",
      "args": ["path-to\\mcp-easy-installer\\build\\index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token" 
      },
      "enable": true,
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

## Platform Testing

This tool has been primarily developed and tested on Windows. While it's designed to be cross-platform, we have limited ability to test on all operating systems.

**Mac and Linux Testing:**
We need feedback from Mac and Linux users to ensure compatibility across all platforms. If you're using this tool on macOS or Linux distributions:

- Please report any issues you encounter in the [GitHub Issues](https://github.com/onigetoc/mcp-easy-installer/issues)
- Specify your operating system version and environment details
- Suggestions for platform-specific improvements are welcome
- Consider contributing platform-specific fixes if you have the expertise

Your feedback is invaluable in making this tool work seamlessly across all operating systems.

---

[![Follow @intelixai_com](https://img.shields.io/twitter/follow/intelixai_com?style=social)](https://twitter.com/intelixai_com)

---

## Example MCP Server Bin Paths

- **Windows:**
  ```
  C:\Users\USERNAME\Documents\Flowvibe\MCP\server-fileserver\dist\index.js
  ```
- **Linux/Mac:**
  ```
  /home/USERNAME/Documents\Flowvibe\MCP/server-fileserver/dist/index.js
  ```

---

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

---

## Contributing

1. Fork the repository.
2. Create a new branch.
3. Make your changes.
4. Submit a pull request.

---

## License

MIT