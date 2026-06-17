"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ASTManager_1 = require("./src/graph/ASTManager");
const VectorStore_1 = require("./src/memory/VectorStore");
const LocalKeywordEmbeddingProvider_1 = require("./src/ai/LocalKeywordEmbeddingProvider");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
async function testStreamPilot() {
    const root = 'C:\\Users\\kamit\\.gemini\\antigravity\\scratch\\streampilot-ai';
    console.log(`Initializing AI Memory OS on: ${root}`);
    const ast = new ASTManager_1.ASTManager(root);
    const vector = new VectorStore_1.VectorStore(root, new LocalKeywordEmbeddingProvider_1.LocalKeywordEmbeddingProvider());
    await ast.init();
    await vector.init();
    console.log("Indexing critical StreamPilot files...");
    const files = ['backend/server.py', 'app.js']; // Just index a couple files to test
    for (const file of files) {
        const fullPath = path.join(root, file);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            await ast.parseFile(fullPath, content);
            const chunks = [{
                    filePath: fullPath,
                    content: content,
                    metadata: { lineStart: 1, lineEnd: 50, type: 'chunk' }
                }];
            await vector.upsert(fullPath, chunks);
            console.log(`Indexed ${file}`);
        }
    }
    console.log("\nSearching for 'YouTube Analytics' in StreamPilot...");
    const results = await vector.search("YouTube Analytics", 1);
    console.log(`Found ${results.length} results.`);
    for (const r of results) {
        console.log(`- Top hit in file: ${path.basename(r.filePath)}`);
        console.log(`- Content Snippet: ${r.content.substring(0, 100).replace(/\n/g, ' ')}...`);
    }
}
testStreamPilot().catch(console.error);
//# sourceMappingURL=run_test.js.map