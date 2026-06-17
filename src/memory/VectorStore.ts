import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';
import { EmbeddingProvider } from '../ai/EmbeddingProvider';

export interface CodeChunk {
    filePath: string;
    content: string;
    vector?: number[];
    metadata: {
        lineStart: number;
        lineEnd: number;
        type: string; // 'function', 'class', 'chunk'
    };
}

export class VectorStore {
    private db: lancedb.Connection | null = null;
    private table: lancedb.Table | null = null;
    private readonly dbPath: string;
    private readonly tableName = 'code_chunks_v2';
    private readonly workspacePath: string;
    private readonly stopWords = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'codebase', 'does', 'for', 'from',
        'handle', 'how', 'in', 'is', 'it', 'makima', 'of', 'on', 'or', 'project',
        'the', 'this', 'to', 'with'
    ]);

    constructor(workspacePath: string, private readonly embeddingProvider: EmbeddingProvider) {
        this.workspacePath = workspacePath;
        this.dbPath = path.join(workspacePath, '.ai-memory-db');
    }

    async init() {
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }
        this.db = await lancedb.connect(this.dbPath);
        
        try {
            this.table = await this.db.openTable(this.tableName);
        } catch (e) {
            // Table doesn't exist, create it later when first data arrives
            this.table = null;
        }
        console.log('VectorStore initialized at:', this.dbPath);
    }

    async addChunks(chunks: CodeChunk[]) {
        if (!this.db) throw new Error('Database not initialized');
        if (chunks.length === 0) return;

        const dataWithVectors = [];
        for (const chunk of chunks) {
            const vector = await this.embeddingProvider.embed(this.buildEmbeddingText(chunk), {
                taskType: 'RETRIEVAL_DOCUMENT',
                title: path.basename(chunk.filePath)
            });
            dataWithVectors.push({
                vector,
                filePath: chunk.filePath,
                content: chunk.content,
                lineStart: chunk.metadata.lineStart,
                lineEnd: chunk.metadata.lineEnd,
                type: chunk.metadata.type,
                embeddingProvider: await this.getEmbeddingProviderName()
            });
        }

        if (!this.table) {
            this.table = await this.db.createTable(this.tableName, dataWithVectors);
        } else {
            await this.table.add(dataWithVectors);
        }
    }

    async upsert(filePath: string, chunks: CodeChunk[]) {
        if (!this.db) throw new Error('Database not initialized');
        
        // Remove old chunks for this file
        if (this.table) {
            try {
                // LanceDB delete by filter
                await this.table.delete(`filePath = '${this.escapeFilterValue(filePath)}'`);
            } catch (e) {
                console.warn('Error deleting old chunks:', e);
            }
        }

        if (chunks.length > 0) {
            await this.addChunks(chunks);
        }
    }

    async search(query: string, limit: number = 5) {
        if (!this.table) return [];
        const providerName = await this.getEmbeddingProviderName();
        const storedProviderName = await this.getStoredEmbeddingProviderName();
        if ((storedProviderName ?? providerName).startsWith('local-keyword')) {
            return this.localKeywordSearch(query, limit);
        }

        try {
            const queryVector = await this.embeddingProvider.embed(query, {
                taskType: 'RETRIEVAL_QUERY'
            });
            const vectorResults = await this.table.vectorSearch(queryVector)
                .limit(Math.max(30, limit * 8))
                .toArray();
            const lexicalResults = await this.localKeywordSearch(query, Math.max(30, limit * 8));
            return this.mergeHybridResults(query, vectorResults, lexicalResults, limit);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`AI Memory vector search failed, using keyword fallback: ${message}`);
            return this.localKeywordSearch(query, limit);
        }
    }

    async deleteFile(filePath: string) {
        if (!this.table) return;
        await this.table.delete(`filePath = '${this.escapeFilterValue(filePath)}'`);
    }

    async getChunkCount(): Promise<number> {
        if (!this.table) return 0;
        return this.table.countRows();
    }

    async getEmbeddingProviderName(): Promise<string> {
        return this.embeddingProvider.getActiveProviderName
            ? this.embeddingProvider.getActiveProviderName()
            : this.embeddingProvider.name;
    }

    private async getStoredEmbeddingProviderName(): Promise<string | undefined> {
        if (!this.table) return undefined;

        try {
            const rows = await this.table.query()
                .select(['embeddingProvider'])
                .limit(1)
                .toArray();
            return rows[0]?.embeddingProvider;
        } catch (error) {
            return undefined;
        }
    }

    async clear() {
        if (this.db) {
            try {
                await this.db.dropTable(this.tableName);
                this.table = null;
            } catch (e) {}
        }
    }

    private escapeFilterValue(value: string): string {
        return value.replace(/'/g, "''");
    }

    private buildEmbeddingText(chunk: CodeChunk): string {
        const relativePath = path.relative(this.workspacePath, chunk.filePath);
        return `${relativePath}\n${chunk.metadata.type}\n${chunk.content}`;
    }

    private async localKeywordSearch(query: string, limit: number): Promise<any[]> {
        if (!this.table) return [];

        const queryTokens = this.tokenize(query);
        let q = this.table.query().select(['filePath', 'content', 'lineStart', 'lineEnd', 'type', 'embeddingProvider']);
        
        if (queryTokens.length > 0) {
            const conditions = queryTokens.map(token => `content LIKE '%${this.escapeFilterValue(token)}%' OR filePath LIKE '%${this.escapeFilterValue(token)}%'`);
            q = q.where(conditions.join(' OR '));
        }

        // Limit the rows fetched into Node.js memory to prevent Out-Of-Memory crashes
        const rows = await q.limit(2000).toArray();
        const ranked = this.rerankLocalResults(query, rows)
            .filter(result => result._score > 0);

        return (ranked.length > 0 ? ranked : rows).slice(0, limit);
    }

    private rerankLocalResults(query: string, results: any[]): any[] {
        const queryTokens = this.tokenize(query);
        if (queryTokens.length === 0) return results;
        const normalizedQuery = query.toLowerCase();

        return results
            .map(result => {
                const pathScore = this.lexicalScore(queryTokens, result.filePath) * 4;
                const contentScore = this.lexicalScore(queryTokens, result.content);
                const score = pathScore + contentScore + this.intentPathBoost(normalizedQuery, result.filePath);

                return {
                    result: {
                        ...result,
                        _score: score
                    },
                    score
                };
            })
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return (a.result._distance ?? 0) - (b.result._distance ?? 0);
            })
            .map(item => item.result);
    }

    private mergeHybridResults(query: string, vectorResults: any[], lexicalResults: any[], limit: number): any[] {
        const merged = new Map<string, any>();

        const add = (result: any) => {
            const key = `${result.filePath}:${result.lineStart}:${result.lineEnd}`;
            const existing = merged.get(key);
            if (!existing) {
                merged.set(key, { ...result });
                return;
            }

            merged.set(key, {
                ...existing,
                ...result,
                _distance: this.bestDistance(existing._distance, result._distance)
            });
        };

        vectorResults.forEach(add);
        lexicalResults.forEach(add);

        const queryTokens = this.tokenize(query);
        const normalizedQuery = query.toLowerCase();

        return Array.from(merged.values())
            .map(result => {
                const pathScore = this.lexicalScore(queryTokens, result.filePath) * 4;
                const contentScore = this.lexicalScore(queryTokens, result.content);
                const intentBoost = this.intentPathBoost(normalizedQuery, result.filePath);
                const semanticBoost = typeof result._distance === 'number'
                    ? Math.max(0, 2 - result._distance) * 3
                    : 0;
                const score = pathScore + contentScore + intentBoost + semanticBoost;

                return {
                    ...result,
                    _score: score
                };
            })
            .sort((a, b) => {
                if (b._score !== a._score) return b._score - a._score;
                return (a._distance ?? 0) - (b._distance ?? 0);
            })
            .slice(0, limit);
    }

    private bestDistance(first: unknown, second: unknown): number | undefined {
        if (typeof first === 'number' && typeof second === 'number') {
            return Math.min(first, second);
        }
        if (typeof first === 'number') return first;
        if (typeof second === 'number') return second;
        return undefined;
    }

    private intentPathBoost(normalizedQuery: string, filePath: string): number {
        const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

        if ((normalizedQuery.includes('speech to text') || normalizedQuery.includes('voice input')) && normalizedPath.includes('stt')) {
            return 20;
        }

        if ((normalizedQuery.includes('text to speech') || normalizedQuery.includes('voice output')) && normalizedPath.includes('tts')) {
            return 20;
        }

        return 0;
    }

    private lexicalScore(queryTokens: string[], text: string): number {
        const textTokens = new Set(this.tokenize(text));
        let score = 0;

        for (const token of queryTokens) {
            if (textTokens.has(token)) {
                score += token.length <= 3 ? 1 : 3;
            }
        }

        return score;
    }

    private tokenize(text: string): string[] {
        const normalized = text
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]/g, ' ')
            .toLowerCase()
        const tokens: string[] = normalized.match(/[a-z0-9]+/g) ?? [];

        if (normalized.includes('speech to text') || normalized.includes('voice input')) {
            tokens.push('stt', 'transcription');
        }
        if (normalized.includes('text to speech') || normalized.includes('voice output')) {
            tokens.push('tts', 'synthesis');
        }

        return tokens.filter(token => !this.stopWords.has(token));
    }
}
