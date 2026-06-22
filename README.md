# AI Memory OS 🧠⚡

**Supercharge your VS Code with a local, intelligent memory system designed for both humans and AI Agents.**

[![VS Code Extension](https://img.shields.io/visual-studio-code/v/1.80.0?logo=visualstudiocode)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-81.3%25-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code Size](https://img.shields.io/github/languages/code-size/Pggamerbgoy/longfun?logo=github)](https://github.com/Pggamerbgoy/longfun)

AI Memory OS is a high-performance workspace intelligence extension that bridges the gap between **Structural AST Analysis** and **Semantic Vector Retrieval**. It gives you (and your AI assistants) persistent, token-efficient context about your entire codebase with real-time synchronization.

**Perfect for**: VS Code users, AI agent integration, developers working with large codebases, Claude Code integration, workspace intelligence, semantic code search.

---

## 🚀 Key Features

### 1. Hybrid Intelligence Stack
Combines **web-tree-sitter (AST)** for deterministic dependency mapping with **LanceDB (Vector RAG)** for semantic search. It doesn't just find words; it understands code relationships.

### 2. Continuous Intelligence (Real-time Sync)
Our **ContinuousDiffEngine** monitors your filesystem and updates the memory index in the background within 2 seconds of any change. No manual re-indexing required.

### 3. Agent-First Design (Headless CLI)
Built specifically for agents like **Antigravity** and **Claude Code**. Exposes a dedicated CLI bridge so AI agents can "plug in" to your project's local memory to answer questions faster and cheaper.

### 4. Visual Dependency Graph 🗺️
Generate high-fidelity **Mermaid.js** diagrams of your project's architecture directly inside VS Code. See exactly how files are connected and how a change in one place impacts the rest.

### 5. Token-Efficient "Smart Answers" 🧠
Our built-in **Cache Manager** prunes and optimizes code context before sending it to the LLM, ensuring you stay well within **Free Tier** token limits (like the 150k limit) while getting Pro-level answers.

### 6. MCP Server Integration
Seamlessly integrate with Claude Code through the Model Context Protocol (MCP). Add to your `claude.json`:

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

**Available MCP Tools**:
- `ai_memory_status` - Check indexing status
- `ai_memory_project_map` - Get high-level directory map
- `ai_memory_search` - Semantic vector search (CRITICAL for token savings)
- `ai_memory_impact` - Dependency graph analysis
- `ai_memory_answer` - Get grounded answers about your codebase

---

## 📦 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Parsing** | web-tree-sitter (WASM) |
| **Vector Database** | @lancedb/lancedb + apache-arrow |
| **Languages Supported** | TypeScript, JavaScript, Python |
| **Interface** | VS Code Webview + Mermaid.js |
| **AI Integration** | Gemini API, HuggingFace Transformers.js |
| **Protocol** | Model Context Protocol (MCP) |

---

## 🛠️ Commands

| Command | Description |
|---------|------------|
| `AI Memory: Start Service` | Initializes local indexing |
| `AI Memory: Ask a Question` | Synthesize answers from your project memory |
| `AI Memory: Reindex Workspace` | Force full workspace reindexing |
| `AI Memory: Show Index Status` | View current indexing progress |
| `AI Memory: Set Gemini API Key` | Configure AI response generation |
| `AI Memory: Analyze Impact` | See which files are affected by changes |
| `AI Memory: Show Project Map` | View high-level project structure |
| `AI Memory: Show Dependency Graph` | Visualize project architecture |

---

## ⚙️ Configuration

Customize AI Memory OS via VS Code settings:

```json
{
  "aiMemory.autoIndexOnStartup": true,
  "aiMemory.geminiModel": "gemini-2.5-flash",
  "aiMemory.embeddingModel": "Xenova/all-MiniLM-L6-v2",
  "aiMemory.embeddingDimensions": 384,
  "aiMemory.maxIndexedFileSizeKb": 512
}
```

---

## 🚀 Quick Start

1. **Install** the extension from VS Code Marketplace
2. **Run** `AI Memory: Start Service` to begin indexing
3. **Ask questions** using `AI Memory: Ask a Question`
4. **Visualize** your project with `AI Memory: Show Dependency Graph`

---

## 🎯 Use Cases

- **AI Agent Integration**: Enable Claude Code and other agents to understand your codebase instantly
- **Large Codebase Navigation**: Quickly understand dependencies and architecture
- **Code Impact Analysis**: See which files are affected by changes before committing
- **Token-Efficient AI Interactions**: Get better answers within token limits
- **Knowledge Base Creation**: Build persistent project memory for team onboarding

---

## 🔧 Development

```bash
# Compile TypeScript
npm run compile

# Run tests
npm run test

# Watch for changes
npm run watch

# Start MCP server
npm run mcp

# Build for production
npm run package
```

---

## 📋 Requirements

- VS Code 1.80.0 or later
- Node.js 16+
- For AI features: Gemini API key (free tier available)

---

## 📄 License

MIT License - See LICENSE file for details

---

## 👨‍💻 Author

Developed with ❤️ by **[Pggamerbgoy](https://github.com/Pggamerbgoy)**

*Designed to make coding faster, smarter, and token-efficient.*

---

## 🤝 Contributing

Contributions welcome! Feel free to open issues and pull requests.

---

## 📚 Related Topics

`vscode-extension` · `ai-agent` · `code-intelligence` · `semantic-search` · `ast-parsing` · `vector-database` · `context-caching` · `mcp` · `claude-code` · `workspace-analysis`
