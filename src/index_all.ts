import { ASTManager } from './graph/ASTManager';
import { VectorStore } from './memory/VectorStore';
import { LocalKeywordEmbeddingProvider } from './ai/LocalKeywordEmbeddingProvider';
import * as path from 'path';
import * as fs from 'fs';

async function indexAll() {
    console.log('🚀 --- Indexing Entire Makima Workspace --- 🚀');
    
    const workspaceRoot = 'c:\\code\\makima_fixed';
    const extensionDir = 'C:\\Users\\kamit\\.gemini\\antigravity\\scratch\\ai-memory-extension';
    
    const ast = new ASTManager(workspaceRoot);
    const vector = new VectorStore(extensionDir, new LocalKeywordEmbeddingProvider());

    await ast.init();
    await vector.init();

    function getFiles(dir: string, fileList: string[] = []): string[] {
        if (!fs.existsSync(dir)) return fileList;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                if (!['node_modules', '.git', '__pycache__', '.agent', 'dist', 'build', '.pytest_cache', 'makima_memory', 'logs', 'data', 'screenshots', 'whatsapp_session', 'tmp', 'scratch'].includes(file)) {
                    getFiles(filePath, fileList);
                }
            } else if (file.endsWith('.py') || file.endsWith('.ts') || file.endsWith('.js')) {
                fileList.push(filePath);
            }
        });
        return fileList;
    }

    console.log('Scanning workspace...');
    const allFiles = getFiles(workspaceRoot);
    console.log(`Found ${allFiles.length} files to index.`);

    for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        if (i % 20 === 0) console.log(`Progress: ${i}/${allFiles.length}...`);
        
        try {
            const content = fs.readFileSync(file, 'utf-8');
            await ast.parseFile(file, content);
            
            const lines = content.split('\n');
            const chunks = [];
            // Chunk every 50 lines for better granularity
            for (let j = 0; j < lines.length; j += 50) {
                chunks.push({
                    filePath: file,
                    content: lines.slice(j, j + 50).join('\n'),
                    metadata: { lineStart: j + 1, lineEnd: j + 50, type: 'chunk' }
                });
            }
            await vector.upsert(file, chunks);
        } catch (e) {
            console.error(`Error indexing ${file}:`, e);
        }
    }

    console.log('\n✅ Workspace Memory Updated!');
}

indexAll().catch(console.error);
