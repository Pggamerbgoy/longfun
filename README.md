# AI Memory OS 🧠⚡

**Supercharge your VS Code with a local, intelligent memory system designed for both humans and AI Agents.**

AI Memory OS is a high-performance workspace intelligence extension that bridges the gap between **Structural AST Analysis** and **Semantic Vector Retrieval**. It gives you (and your AI assistants) a "Super-Brain" that remembers every file, dependency, and logic flow in your project.

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

---

## 🛠️ Commands

- `AI Memory: Start Service` - Initializes local indexing.
- `AI Memory: Ask a Question` - Synthesize answers from your project memory.
- `AI Memory: Analyze Impact` - See which files are affected by changes in the current editor.
- `AI Memory: Show Dependency Graph` - Visualize your project's architecture.

---

## 📦 Tech Stack
- **Parsing**: `web-tree-sitter` (WASM)
- **Vector DB**: `@lancedb/lancedb` + `apache-arrow`
- **Languages**: TypeScript, JavaScript, Python
- **Interface**: VS Code Webview + Mermaid.js

---

## 👨‍💻 Author
Developed with ❤️ by **Pggamerbgoy**.

*Designed to make coding faster, smarter, and token-efficient.*
