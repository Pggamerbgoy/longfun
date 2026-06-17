# AI Memory OS - MCP Server Integration

This project includes a fully functional Model Context Protocol (MCP) server that exposes the AI Memory OS capabilities directly to Claude Code. 

To enable Claude Code to automatically use AI Memory for optimized context retrieval and token savings, add the following configuration to your `claude.json` (or let Claude parse it from here):

```json
{
  "mcpServers": {
    "ai-memory": {
      "command": "node",
      "args": ["${workspaceFolder}/out/mcp_server.js"],
      "env": {
        "WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

### Available MCP Tools:
1. **`ai_memory_status`**: Checks the indexing status of the workspace.
2. **`ai_memory_project_map`**: Gets the high-level directory map of the project.
3. **`ai_memory_search`**: Searches the codebase using semantic vector search. *(CRITICAL for token savings)*
4. **`ai_memory_impact`**: Analyzes the dependency graph to find what files depend on a given file.
5. **`ai_memory_answer`**: Ask a question, and it returns a grounded answer.

*Note: You must run `npm run compile` at least once before using the MCP server so `out/mcp_server.js` is generated.*
