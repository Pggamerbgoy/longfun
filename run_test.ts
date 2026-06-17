import { ASTManager } from './src/graph/ASTManager';
import { VectorStore } from './src/memory/VectorStore';
import { LocalKeywordEmbeddingProvider } from './src/ai/LocalKeywordEmbeddingProvider';
import * as path from 'path';
import * as fs from 'fs';

async function testStreamPilot() {
    const root = 'C:\\Users\\kamit\\.gemini\\antigravity\\scratch\\streampilot-ai';
    console.log(`Initializing AI Memory OS on: ${root}`);
    
    const ast = new ASTManager(root);
    const vector = new VectorStore(root, new LocalKeywordEmbeddingProvider());

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
