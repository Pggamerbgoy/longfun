import * as path from 'path';
import { BrainManager } from '../brain/BrainManager';
import { ASTManager } from '../graph/ASTManager';
import { VectorStore } from '../memory/VectorStore';
import { ProjectMapService } from '../project/ProjectMapService';

export class AiMemoryMcpTools {
    constructor(
        private readonly workspaceRoot: string,
        private readonly astManager: ASTManager,
        private readonly vectorStore: VectorStore,
        private readonly brain: BrainManager,
        private readonly projectMapService: ProjectMapService
    ) {}

    async statusText(maxTokens: number = 800): Promise<string> {
        return this.toBoundedJson({
            summary: 'AI Memory workspace status',
            workspace: this.workspaceRoot,
            chunks: await this.vectorStore.getChunkCount(),
            graphFiles: this.astManager.getFileCount(),
            embeddingProvider: await this.vectorStore.getEmbeddingProviderName()
        }, maxTokens);
    }

    async projectMapText(query?: string, maxTokens: number = 1200): Promise<string> {
        if (query && query.trim().length > 0) {
            const chunks = await this.vectorStore.search(query, 8);
            const map = await this.projectMapService.buildRelevantMap(query, chunks);
            return this.toBoundedJson({
                summary: map.summary,
                targetFiles: map.targetFiles,
                relatedFiles: map.relatedFiles,
                impactedFiles: map.impactedFiles,
                suggestedChecks: map.suggestedChecks,
                structure: map.structure
            }, maxTokens);
        }

        const map = this.projectMapService.buildWorkspaceMap();
        return this.toBoundedJson({
            summary: map.summary,
            entries: map.entries
        }, maxTokens);
    }

    async searchText(query: string, maxTokens: number = 1600): Promise<string> {
        const chunks = await this.vectorStore.search(query, 8);
        const map = await this.projectMapService.buildRelevantMap(query, chunks);
        return this.toBoundedJson({
            summary: `Search results for "${query}"`,
            targetFiles: map.targetFiles,
            relatedFiles: map.relatedFiles,
            impactedFiles: map.impactedFiles,
            suggestedChecks: map.suggestedChecks,
            snippets: chunks.slice(0, 5).map(chunk => ({
                file: this.relativePath(chunk.filePath),
                lines: `${chunk.lineStart}-${chunk.lineEnd}`,
                snippet: this.compactSnippet(chunk.content, 420)
            }))
        }, maxTokens);
    }

    async impactText(fileOrQuery: string, maxTokens: number = 1400): Promise<string> {
        const target = this.astManager.findFilesInQuery(fileOrQuery, 1)[0];
        if (!target) {
            return this.toBoundedJson({
                summary: `No indexed file matched "${fileOrQuery}".`,
                targetFiles: [],
                relatedFiles: [],
                impactedFiles: [],
                suggestedChecks: ['Run AI Memory indexing, then retry with a file name or relative path.']
            }, maxTokens);
        }

        const impact = await this.astManager.getFileImpact(target);
        const localImports = impact.imports
            .filter(file => this.astManager.isIndexedFile(file))
            .map(file => this.relativePath(file));
        const directDependents = impact.directDependents.map(file => this.relativePath(file));
        const impactedFiles = impact.impactedFiles
            .filter(file => file !== impact.filePath)
            .map(file => this.relativePath(file));
        const map = await this.projectMapService.buildRelevantMap(fileOrQuery, []);

        return this.toBoundedJson({
            summary: `Impact for ${this.relativePath(impact.filePath)}`,
            targetFiles: [this.relativePath(impact.filePath)],
            relatedFiles: [...new Set([...localImports, ...directDependents])],
            impactedFiles,
            suggestedChecks: map.suggestedChecks,
            structure: map.structure
        }, maxTokens);
    }

    async answerText(query: string, maxTokens: number = 2400): Promise<string> {
        const answer = await this.brain.ask(query);
        return this.toBoundedJson({
            summary: `Grounded AI Memory answer for "${query}"`,
            answer: this.compactSnippet(answer, Math.max(1000, maxTokens * 4 - 400))
        }, maxTokens);
    }

    private toBoundedJson(value: unknown, maxTokens: number): string {
        const maxChars = Math.max(800, maxTokens * 4);
        const text = JSON.stringify(value, null, 2);
        if (text.length <= maxChars) {
            return text;
        }

        return JSON.stringify({
            truncated: true,
            maxTokens,
            preview: text.slice(0, maxChars - 220),
            note: 'Output was compacted to stay under the requested token budget.'
        }, null, 2);
    }

    private compactSnippet(content: string, maxChars: number): string {
        const compact = content.replace(/\s+/g, ' ').trim();
        return compact.length > maxChars ? `${compact.slice(0, maxChars)}...` : compact;
    }

    private relativePath(filePath: string): string {
        return path.relative(this.workspaceRoot, path.resolve(filePath)).replace(/\\/g, '/');
    }
}
