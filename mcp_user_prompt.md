I want to create a MCP server repairer. Read the @/mcp_typescript_infos.md and the @/mcp_details_generator.md to help you with this task. the MCP TypeScript MD files should not be edited or modified. afin de t'aider à programmer un MCP serveur en TypeScript. 

So we have to use Node.js and TypeScript for this MCP server repair tool. The script must go to a folder C:\Users\LENOVO\OneDrive\Documents\Cline\MCP to find the MCP requested by the user with node fs and sould find the right folder. The main folder path is this one.

C:\Users\LENOVO\OneDrive\Documents\Cline\MCP

```xml
<example>
 <user>
Help me fix my wikipedia mcp server
</user>
<mcp-repair-tool>
1. the mcp-repair-tools will go to the mcp folder server mentionned. 
2. It should find the folder with the name wikipedi whathever is the name. (using the right node library or with some regex, find the best way to find the right folder)
3. then enter this folder. Check if there's a package.json file.
4. Check if a "node_modules" folder exist.
5. Read the package.json file if it exist.
6. chack the script key:
7. It should look if there is a folder in the main folde (i.e wikipedia) that was asked at the beginning, if there is a build or dist file. and check if there is somewhere in this file a file ending with .js. Normally it should be index.js.
<wikipedia-package-example>
{
  "name": "wikipedia-server",
  "version": "1.0.0",
  "description": "Wikipedia MCP server",
  "type": "module",
  "main": "build/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node build/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.6.7"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
</wikipedia-package-example>
8. it should find some where in this wikipedia. folder a .js file usually named index.js
9. If he doesn't find this file, he must install le projet avec npm install.
10. In the package.json file that has been read, it must have found the build script and triggered it with npm. Normally, it would be "npm run build".
11. It must verify if in the build or dist folder, if there is a new index.js file that has been created.
Il doit trouver le patte complet de ce fichier dans l'ordinateur Windows à partir du premier patte de départ qui a été donnée au départ.
in this example:
C:\Users\LENOVO\OneDrive\Documents\Cline\MCP\wikipedia-server\build\index.js
12. The final mcp-repaire-tool answer should include:
    "wikipedia": {
      "command": "node",
      "args": [
        "C:\\Users\\LENOVO\\OneDrive\\Documents\\Cline\\MCP\\wikipedia-server\\build\\index.js"
      ],
      "enabled": true
    }
</mcp-repair-tool>
</example>
```

13. **Dependencies**:
   - Ensure all required dependencies are installed, including `@modelcontextprotocol/sdk` and `typescript`.

14. **Error Handling**:
   - Provide clear error messages if the `index.js` file is not found or if the build process fails.

15. **Installation Instructions**:
   - Include commands to install dependencies and run the tool:
     ```bash
     npm install
     npm run build
     npm start
     ```

16. **Documentation**:
    - Reference the `@/mcp_typescript_infos.md` and `@/mcp_details_generator.md` files for additional context without modifying them.

The tool must be fully automated and provide a clear output format for integration with MCP server management systems.

You Should install @modelcontextprotocol :

And ad this to the index.ts main file or every else file who need it:
```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
```

## Demo from filesystem-server
using tools:

```json
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

