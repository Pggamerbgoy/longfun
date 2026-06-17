import { VectorStore } from '../memory/VectorStore';
import { ASTManager } from '../graph/ASTManager';
import { CacheManager } from '../memory/CacheManager';
import { AnswerContext, AnswerContextChunk, AnswerProvider } from '../ai/AnswerProvider';
import { LocalGroundedAnswerProvider } from '../ai/LocalGroundedAnswerProvider';
import { ProjectMapService } from '../project/ProjectMapService';

export class BrainManager {
    private vectorStore: VectorStore;
    private astManager: ASTManager;
    private cacheManager: CacheManager;
    private answerProvider: AnswerProvider;
    private localAnswerProvider = new LocalGroundedAnswerProvider();
    private projectMapService: ProjectMapService;

    constructor(vectorStore: VectorStore, astManager: ASTManager, answerProvider: AnswerProvider) {
        this.vectorStore = vectorStore;
        this.astManager = astManager;
        this.answerProvider = answerProvider;
        this.cacheManager = new CacheManager(150000); // Default to 150k budget
        this.projectMapService = new ProjectMapService(astManager.getWorkspaceRoot(), astManager);
    }

    async ask(query: string): Promise<string> {
        console.log(`Brain is thinking about: "${query}"...`);

        // 1. Retrieve Semantic Context (RAG)
        const searchResults = await this.vectorStore.search(query, 8) as AnswerContextChunk[];
        
        // 2. Retrieve Graph Context (AST)
        const graphContext = await this.buildGraphContext(query, searchResults);
        const relevantMap = await this.projectMapService.buildRelevantMap(query, searchResults);
        const projectMapContext = this.projectMapService.renderRelevantMap(relevantMap);

        // 3. Optimize Context for Token Budget (The "Free Tier" Logic)
        const optimizedPrompt = this.cacheManager.optimizeContext(searchResults, query, graphContext, projectMapContext);
        
        console.log('\n--- EXTRACTED CHUNKS & DATA SENT TO AI ---');
        console.log(`QUESTION:\n${query}\n`);
        console.log(optimizedPrompt);
        console.log('------------------------------------------\n');

        const context: AnswerContext = {
            query,
            chunks: searchResults,
            projectMapContext,
            graphContext,
            optimizedPrompt
        };

        let finalAnswer = '';
        if (await this.answerProvider.isConfigured()) {
            try {
                finalAnswer = await this.answerProvider.answer(context);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const localAnswer = await this.localAnswerProvider.answer(context);
                finalAnswer = `${localAnswer}\n\nGemini answer failed: ${message}`;
            }
        } else {
            finalAnswer = await this.localAnswerProvider.answer(context);
        }

        console.log('\n--- AI REPLY ---');
        console.log(finalAnswer);
        console.log('----------------\n');

        return finalAnswer;
    }

    private async buildGraphContext(query: string, results: AnswerContextChunk[]): Promise<string> {
        const lines: string[] = [];
        const seenFiles = new Set<string>();
        const fileFocusMatches = this.astManager.findFilesInQuery(query, 3);

        for (const filePath of fileFocusMatches) {
            if (seenFiles.has(filePath)) continue;
            seenFiles.add(filePath);

            const impact = await this.astManager.getFileImpact(filePath);
            const relativeFile = this.astManager.getRelativePath(impact.filePath);
            const imports = impact.imports
                .filter(file => file !== impact.filePath && this.astManager.isIndexedFile(file))
                .map(file => this.astManager.getRelativePath(file));
            const directDependents = impact.directDependents.map(file => this.astManager.getRelativePath(file));
            const impactedFiles = impact.impactedFiles
                .filter(file => file !== impact.filePath)
                .map(file => this.astManager.getRelativePath(file));

            lines.push(`File impact focus: ${relativeFile}`);
            lines.push(`- Imports/depends on: ${imports.length > 0 ? imports.slice(0, 8).join(', ') : 'none detected in indexed graph'}`);
            lines.push(`- Directly used by: ${directDependents.length > 0 ? directDependents.slice(0, 8).join(', ') : 'none detected in indexed graph'}`);
            lines.push(`- Changing this may affect ${impactedFiles.length} indexed file(s): ${impactedFiles.length > 0 ? impactedFiles.slice(0, 12).join(', ') : 'none detected'}`);
            lines.push(`- Suggested checks: inspect this file's public functions/classes, review direct users, then run nearby tests/scripts that mention ${relativeFile.split('/').pop()}.`);
            lines.push('');
        }

        for (const result of results.slice(0, 3)) {
            if (seenFiles.has(result.filePath)) continue;
            seenFiles.add(result.filePath);

            const affected = await this.astManager.analyzeImpact(result.filePath);
            if (affected.length > 1) {
                const relativeFile = this.astManager.getRelativePath(result.filePath);
                lines.push(`${relativeFile} affects ${affected.length - 1} indexed file(s):`);
                affected.slice(1, 8).forEach(file => lines.push(`- ${this.astManager.getRelativePath(file)}`));
            }
        }

        return lines.join('\n');
    }
}
