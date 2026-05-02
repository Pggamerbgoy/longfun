import { VectorStore } from '../memory/VectorStore';
import { ASTManager } from '../graph/ASTManager';
import { CacheManager } from '../memory/CacheManager';

export class BrainManager {
    private vectorStore: VectorStore;
    private astManager: ASTManager;
    private cacheManager: CacheManager;

    constructor(vectorStore: VectorStore, astManager: ASTManager) {
        this.vectorStore = vectorStore;
        this.astManager = astManager;
        this.cacheManager = new CacheManager(150000); // Default to 150k budget
    }

    async ask(query: string): Promise<string> {
        console.log(`Brain is thinking about: "${query}"...`);

        // 1. Retrieve Semantic Context (RAG)
        const searchResults = await this.vectorStore.search(query, 5);
        
        // 2. Retrieve Graph Context (AST)
        // If query mentions a specific file, get its impact
        // (Simple heuristic for now)
        let graphContext = "";
        const potentialFile = searchResults[0]?.filePath;
        if (potentialFile) {
            const affected = await this.astManager.analyzeImpact(potentialFile);
            graphContext = `\nImpact Analysis: Changing this file affects ${affected.length} files: ${affected.join(', ')}`;
        }

        // 3. Optimize Context for Token Budget (The "Free Tier" Logic)
        const optimizedPrompt = this.cacheManager.optimizeContext(searchResults, query);
        
        console.log(`Sending ${optimizedPrompt.length} chars of context to AI...`);

        // This is where we would call:
        // const answer = await gemini.generate(optimizedPrompt + query);
        
        return this.mockAISynthesis(query, searchResults);
    }

    private mockAISynthesis(query: string, results: any[]): string {
        if (results.length === 0) return "I couldn't find any relevant code for that question.";

        let response = `Based on the codebase analysis for "${query}":\n\n`;
        
        results.forEach((res, i) => {
            response += `### ${i + 1}. ${res.filePath.split(/[\\/]/).pop()}\n`;
            response += `- **Context**: Found at lines ${res.lineStart}-${res.lineEnd}.\n`;
            response += `- **Logic**: ${res.content.substring(0, 150).replace(/\n/g, ' ')}...\n\n`;
        });

        response += `\n*Note: This answer was synthesized by combining Semantic RAG and AST Graph Analysis.*`;
        return response;
    }
}
