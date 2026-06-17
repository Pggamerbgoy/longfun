import { VectorStore } from './memory/VectorStore';
import { LocalKeywordEmbeddingProvider } from './ai/LocalKeywordEmbeddingProvider';
import * as path from 'path';
import * as fs from 'fs';

async function runVectorTest() {
    console.log('--- Starting VectorStore Test ---');
    const testWorkspace = path.join(__dirname, 'test-workspace-vector');
    if (!fs.existsSync(testWorkspace)) fs.mkdirSync(testWorkspace);

    const vectorStore = new VectorStore(testWorkspace, new LocalKeywordEmbeddingProvider());
    await vectorStore.init();

    console.log('Adding test chunks...');
    await vectorStore.addChunks([
        {
            filePath: 'auth.ts',
            content: 'export function login(user, pass) { console.log("logging in"); }',
            metadata: { lineStart: 1, lineEnd: 1, type: 'function' }
        },
        {
            filePath: 'user.ts',
            content: 'class User { constructor(name) { this.name = name; } }',
            metadata: { lineStart: 1, lineEnd: 1, type: 'class' }
        },
        {
            filePath: 'db.ts',
            content: 'const db = connect("mongodb://localhost:27017");',
            metadata: { lineStart: 1, lineEnd: 1, type: 'chunk' }
        }
    ]);

    console.log('Searching for "login function"...');
    const results = await vectorStore.search('login function', 2);
    
    console.log('Search Results:');
    results.forEach((r: any, i: number) => {
        console.log(`${i+1}. [${r.filePath}] ${r.content.substring(0, 50)}...`);
    });

    if (results.length > 0 && results[0].filePath === 'auth.ts') {
        console.log('✅ VECTOR TEST PASSED: Search returned relevant file.');
    } else {
        console.log('❌ VECTOR TEST FAILED: Result mismatch.');
    }

    // Cleanup
    // await vectorStore.clear();
}

runVectorTest().catch(console.error);
