export interface PromptBudget {
    maxTokens: number;
    preferredChunkCount: number;
}

export class CacheManager {
    private budget: PromptBudget;

    constructor(maxTokens: number = 150000) {
        this.budget = {
            maxTokens: maxTokens,
            preferredChunkCount: 5
        };
    }

    /**
     * Optimizes context to fit within a specific token budget.
     * Useful for Free Plan users.
     */
    optimizeContext(chunks: any[], query: string, graphContext: string = "", projectMapContext: string = ""): string {
        console.log(`Optimizing context for budget: ${this.budget.maxTokens} tokens...`);
        // 1. Sort chunks by relevance score (already done by vector search)
        // 2. Estimate tokens (rough estimate: 4 chars = 1 token)
        let totalTokens = 0;
        const acceptedChunks = [];

        for (const chunk of chunks) {
            const estimatedTokens = Math.ceil(chunk.content.length / 4);
            
            // Stay well under the budget (leave room for the query and AI response)
            // For a 150k limit, we aim to keep context under 100k or even much less (5k-10k)
            // for maximum speed and cost efficiency.
            const safetyLimit = Math.min(this.budget.maxTokens * 0.8, 10000); 

            if (totalTokens + estimatedTokens < safetyLimit) {
                acceptedChunks.push(chunk);
                totalTokens += estimatedTokens;
            } else {
                break;
            }
        }

        console.log(`[AI Memory] Tokens used: ${totalTokens}. Budget remaining: ${this.budget.maxTokens - totalTokens}`);

        // 3. Construct the optimized prompt
        let prompt = `RELEVANT CODE CONTEXT (Budget-Optimized):\n`;
        prompt += `=========================================\n\n`;

        if (projectMapContext) {
            prompt += `COMPACT PROJECT MAP:\n${projectMapContext}\n\n`;
        }

        acceptedChunks.forEach((c, i) => {
            prompt += `[File ${i+1}: ${c.filePath}]\n`;
            prompt += `Lines: ${c.lineStart}-${c.lineEnd}\n`;
            prompt += `\`\`\`\n${this.pruneCode(c.content)}\n\`\`\`\n\n`;
        });

        if (graphContext) {
            prompt += `GRAPH CONTEXT:\n${graphContext}\n\n`;
        }

        return prompt;
    }

    /**
     * Removes noise like heavy comments or docstrings if we are tight on budget.
     */
    private pruneCode(code: string): string {
        // Basic pruning: remove large comment blocks to save tokens
        return code
            .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1') // Remove JS/TS comments
            .replace(/'''[\s\S]*?'''|"""[\s\S]*?"""|#.*$/gm, '') // Remove Python comments/docstrings
            .split('\n')
            .filter(line => line.trim().length > 0)
            .join('\n');
    }
}
