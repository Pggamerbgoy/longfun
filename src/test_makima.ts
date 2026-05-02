import { ASTManager } from './graph/ASTManager';
import { VectorStore } from './memory/VectorStore';
import { BrainManager } from './brain/BrainManager';
import * as path from 'path';
import * as fs from 'fs';

async function testOnMakima() {
    console.log('🧪 --- Testing AI Memory on Makima Fixed --- 🧪');
    
    const makimaPath = 'c:\\code\\makima_fixed';
    const ast = new ASTManager();
    const vector = new VectorStore(path.join(__dirname, 'makima-db'));
    const brain = new BrainManager(vector, ast);

    await ast.init();
    await vector.init();

    // Helper to recursively find python files
    function getPythonFiles(dir: string, fileList: string[] = []): string[] {
        if (!fs.existsSync(dir)) return fileList;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                if (!['node_modules', '.git', '__pycache__', '.agent'].includes(file)) {
                    getPythonFiles(filePath, fileList);
                }
            } else if (file.endsWith('.py')) {
                fileList.push(filePath);
            }
        });
        return fileList;
    }

    console.log('Scanning for Python files in core/ and agents/...');
    const coreFiles = getPythonFiles(path.join(makimaPath, 'core'));
    const agentsFiles = getPythonFiles(path.join(makimaPath, 'agents'));
    const mainFile = path.join(makimaPath, 'makima_assistant.py');
    
    const filesToIndex = [...coreFiles, ...agentsFiles];
    if (fs.existsSync(mainFile)) filesToIndex.push(mainFile);

    console.log(`Found ${filesToIndex.length} files to index.`);

    // Index them
    for (let i = 0; i < filesToIndex.length; i++) {
        const file = filesToIndex[i];
        if (i % 10 === 0) console.log(`Progress: ${i}/${filesToIndex.length}...`);
        
        const content = fs.readFileSync(file, 'utf-8');
        await ast.parseFile(file, content);
        
        const lines = content.split('\n');
        const chunks = [];
        for (let j = 0; j < lines.length; j += 100) {
            chunks.push({
                filePath: file,
                content: lines.slice(j, j + 100).join('\n'),
                metadata: { lineStart: j + 1, lineEnd: j + 100, type: 'chunk' }
            });
        }
        await vector.upsert(file, chunks);
    }

    console.log('\n--- BRAIN: ASK QUESTION TEST ---');
    const query = 'How does the voice engine handle speech to text?';
    console.log(`Asking Brain: "${query}"`);
    
    const answer = await brain.ask(query);
    console.log('\n--- BRAIN ANSWER ---');
    console.log(answer);

    console.log('\n✅ Makima Brain Test Completed!');
}

testOnMakima().catch(console.error);
