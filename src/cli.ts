import { ASTManager } from './graph/ASTManager';
import { VectorStore } from './memory/VectorStore';
import { LocalKeywordEmbeddingProvider } from './ai/LocalKeywordEmbeddingProvider';
import * as path from 'path';

async function main() {
    const query = process.argv[2];
    if (!query) {
        console.error('Usage: ai-memory-search <query>');
        process.exit(1);
    }

    // Initialize with current directory or project root
    const root = process.cwd();
    const ast = new ASTManager(root);
    const vector = new VectorStore(root, new LocalKeywordEmbeddingProvider());

    try {
        await ast.init();
        await vector.init();

        const results = await vector.search(query, 3);
        
        const output = {
            query: query,
            results: await Promise.all(results.map(async (r: any) => {
                const impact = await ast.analyzeImpact(r.filePath);
                return {
                    file: path.relative(root, r.filePath),
                    lines: `${r.lineStart}-${r.lineEnd}`,
                    content: r.content,
                    affectedFiles: impact.map(f => path.relative(root, f))
                };
            }))
        };

        // Output as JSON so the Agent (Antigravity) can parse it perfectly
        console.log(JSON.stringify(output, null, 2));

    } catch (error) {
        console.error('AI Memory Search Error:', error);
        process.exit(1);
    }
}

main();
