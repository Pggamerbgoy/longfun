import { ASTManager } from './graph/ASTManager';
import { VectorStore } from './memory/VectorStore';
import * as path from 'path';
import * as fs from 'fs';

async function runFullDemo() {
    console.log('🚀 --- AI Memory OS: Full Integration Demo --- 🚀');
    
    const demoDir = path.join(__dirname, 'demo-workspace');
    if (!fs.existsSync(demoDir)) fs.mkdirSync(demoDir);

    const ast = new ASTManager();
    const vector = new VectorStore(demoDir);

    console.log('Step 1: Initializing Systems...');
    await ast.init();
    await vector.init();

    console.log('\nStep 2: Indexing Project...');
    const files = [
        {
            name: 'database.ts',
            content: 'export class Database { connect() { console.log("DB Connected"); } }'
        },
        {
            name: 'userService.ts',
            content: 'import { Database } from "./database";\nexport class UserService { constructor(private db: Database) {} getUser() { return "User A"; } }'
        },
        {
            name: 'authController.ts',
            content: 'import { UserService } from "./userService";\nexport class AuthController { login() { const s = new UserService(); return s.getUser(); } }'
        }
    ];

    for (const file of files) {
        const filePath = path.join(demoDir, file.name);
        fs.writeFileSync(filePath, file.content);
        await ast.parseFile(filePath, file.content);
        await vector.upsert(filePath, [{
            filePath,
            content: file.content,
            metadata: { lineStart: 1, lineEnd: 1, type: 'file' }
        }]);
        console.log(`Indexed ${file.name}`);
    }

    console.log('\nStep 3: Simulating a change in database.ts...');
    const targetFile = path.join(demoDir, 'database.ts');
    const affected = await ast.analyzeImpact(targetFile);
    
    console.log('--- IMPACT ANALYSIS ---');
    console.log(`If you modify "database.ts", the following files are affected:`);
    affected.forEach(f => console.log(` - ${path.basename(f)}`));

    console.log('\nStep 4: AI Context Retrieval (RAG)...');
    console.log('AI Query: "How does the user service interact with the database?"');
    const searchResults = await vector.search('user service database interaction', 2);
    
    console.log('--- RETRIEVED CONTEXT ---');
    searchResults.forEach((r: any, i: number) => {
        console.log(`[Result ${i+1}] ${path.basename(r.filePath)}: "${r.content.substring(0, 80)}..."`);
    });

    console.log('\n✅ Full Demo Completed Successfully!');
}

runFullDemo().catch(console.error);
