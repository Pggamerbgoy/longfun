import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AnswerContext, AnswerProvider } from './ai/AnswerProvider';
import { LocalGroundedAnswerProvider } from './ai/LocalGroundedAnswerProvider';
import { LocalKeywordEmbeddingProvider } from './ai/LocalKeywordEmbeddingProvider';
import { BrainManager } from './brain/BrainManager';
import { ASTManager } from './graph/ASTManager';
import { CacheManager } from './memory/CacheManager';
import { WorkspaceIndexService } from './indexing/WorkspaceIndexService';
import { AiMemoryMcpTools } from './mcp/AiMemoryMcpTools';
import { VectorStore } from './memory/VectorStore';
import { ProjectMapService } from './project/ProjectMapService';

class MockAnswerProvider implements AnswerProvider {
    readonly name = 'mock-answer';

    async isConfigured(): Promise<boolean> {
        return true;
    }

    async answer(context: AnswerContext): Promise<string> {
        return `mock answer for ${context.query} using ${context.chunks.length} chunk(s)`;
    }
}

async function main() {
    const workspace = path.join(process.cwd(), '.ai-memory-test-workspace');
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.mkdirSync(path.join(workspace, 'payments'), { recursive: true });

    try {
        const authPath = path.join(workspace, 'auth.ts');
        fs.writeFileSync(authPath, 'export function login(user: string) { return `token:${user}`; }\n');
        fs.writeFileSync(path.join(workspace, 'user.ts'), 'import { login } from "./auth";\nexport const userToken = login("ada");\n');
        fs.writeFileSync(path.join(workspace, 'payments', 'payment.js'), 'const { login } = require("../auth");\nmodule.exports = login("pay");\n');

        const ast = new ASTManager(workspace);
        await ast.init();

        const vector = new VectorStore(workspace, new LocalKeywordEmbeddingProvider());
        await vector.init();

        const index = new WorkspaceIndexService(workspace, ast, vector);

        // REGRESSION TEST: Path Boundary Traversal
        const siblingPath = path.join(process.cwd(), '.ai-memory-test-workspace-hacked', 'file.ts');
        assert.strictEqual(index.shouldIndexFile(siblingPath), false, 'should reject sibling directories that share prefix');
        
        const status = await index.indexWorkspace({ force: true });
        assert.strictEqual(status.indexedFiles, 3, 'indexes supported source files');

        const unchangedStatus = await index.indexWorkspace();
        assert.strictEqual(unchangedStatus.indexedFiles, 0, 'skips unchanged files');
        assert.strictEqual(unchangedStatus.skippedFiles, 3, 'counts unchanged files as skipped');

        const impact = await ast.analyzeImpact(authPath);
        assert.ok(impact.includes(path.join(workspace, 'user.ts')), 'finds TS dependent');
        assert.ok(impact.includes(path.join(workspace, 'payments', 'payment.js')), 'finds JS dependent');

        const fileMatches = ast.findFilesInQuery('I want to change auth.ts', 3);
        assert.strictEqual(fileMatches[0], authPath, 'finds indexed file by mentioned basename');

        const fileImpact = await ast.getFileImpact(authPath);
        assert.ok(fileImpact.directDependents.includes(path.join(workspace, 'user.ts')), 'file impact includes direct TS user');
        assert.ok(fileImpact.directDependents.includes(path.join(workspace, 'payments', 'payment.js')), 'file impact includes direct JS user');

        const fileBrain = new BrainManager(vector, ast, new LocalGroundedAnswerProvider());
        const fileAnswer = await fileBrain.ask('I want to change auth.ts');
        assert.ok(fileAnswer.includes('File impact focus: auth.ts'), 'file-name question includes file impact focus');
        assert.ok(fileAnswer.includes('Project Map Context'), 'answers include compact project map');
        assert.ok(fileAnswer.includes('user.ts'), 'file-name question lists affected files');

        const projectMap = new ProjectMapService(workspace, ast);
        const workspaceMap = projectMap.buildWorkspaceMap();
        assert.ok(workspaceMap.entries.some(entry => entry.path === 'payments/'), 'project map groups top-level folders');
        assert.ok(!projectMap.renderWorkspaceMap(workspaceMap).includes('.ai-memory-db'), 'project map avoids internal db tree');

        const relevantMap = await projectMap.buildRelevantMap('I want to change auth.ts', []);
        assert.ok(relevantMap.targetFiles.includes('auth.ts'), 'relevant map includes target file');
        assert.ok(relevantMap.impactedFiles.includes('user.ts'), 'relevant map includes impacted file');

        const mcpTools = new AiMemoryMcpTools(workspace, ast, vector, fileBrain, projectMap);
        const mcpStatus = await mcpTools.statusText(500);
        assert.ok(mcpStatus.includes('graphFiles'), 'mcp status returns graph status');
        const mcpSearch = await mcpTools.searchText('login token', 700);
        assert.ok(mcpSearch.includes('snippets'), 'mcp search returns snippets');
        const mcpImpact = await mcpTools.impactText('auth.ts', 700);
        assert.ok(mcpImpact.includes('user.ts'), 'mcp impact returns affected files');

        const searchResults = await vector.search('login token', 3);
        assert.ok(searchResults.length > 0, 'search returns indexed chunks');

        fs.writeFileSync(authPath, [
            'export function login(user: string) { return `token:${user}`; }',
            'export function logout(user: string) { return `logout:${user}`; }',
            ''
        ].join('\n'));
        assert.strictEqual(await index.indexFile(authPath), true, 'changed file is upserted');
        const changedResults = await vector.search('logout token', 3);
        assert.ok(changedResults.some(result => result.filePath === authPath), 'changed file can be searched after upsert');

        const countBeforeDelete = await vector.getChunkCount();
        await index.deleteFile(path.join(workspace, 'user.ts'));
        const countAfterDelete = await vector.getChunkCount();
        assert.ok(countAfterDelete < countBeforeDelete, 'delete removes file chunks');

        const localBrain = new BrainManager(vector, ast, new LocalGroundedAnswerProvider());
        const localAnswer = await localBrain.ask('where is login handled?');
        assert.ok(localAnswer.includes('Grounded local answer'), 'no-key answer uses grounded summary');

        const mockBrain = new BrainManager(vector, ast, new MockAnswerProvider());
        const mockAnswer = await mockBrain.ask('where is login handled?');
        assert.ok(mockAnswer.startsWith('mock answer'), 'configured answer provider is used');

        const emptyWorkspace = path.join(workspace, 'empty');
        fs.mkdirSync(emptyWorkspace, { recursive: true });
        const emptyAst = new ASTManager(emptyWorkspace);
        await emptyAst.init();
        const emptyVector = new VectorStore(emptyWorkspace, new LocalKeywordEmbeddingProvider());
        await emptyVector.init();
        const emptyBrain = new BrainManager(emptyVector, emptyAst, new LocalGroundedAnswerProvider());
        const emptyAnswer = await emptyBrain.ask('anything indexed?');
        assert.ok(emptyAnswer.includes('could not find indexed code'), 'empty index has helpful answer');

        // REGRESSION TEST: CacheManager Context Corruption
        const cache = new CacheManager();
        const optimized = cache.optimizeContext([{ filePath: 'test.ts', content: 'let b = 2;//comment', lineStart: 1, lineEnd: 1 }], 'query');
        assert.ok(optimized.includes('let b = 2'), 'should not eat character before comment during pruning');

        console.log('AI Memory core tests passed.');
    } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
