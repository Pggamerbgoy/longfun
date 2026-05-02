import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';

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

    constructor(workspacePath: string) {
        this.dbPath = path.join(workspacePath, '.ai-memory-db');
    }

    async init() {
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }
        this.db = await lancedb.connect(this.dbPath);
        
        try {
            this.table = await this.db.openTable('code_chunks');
        } catch (e) {
            // Table doesn't exist, create it later when first data arrives
            this.table = null;
        }
        console.log('VectorStore initialized at:', this.dbPath);
    }

    // Mock embedding function (replaces text with 384-dim pseudo-random vector)
    private async getEmbedding(text: string): Promise<number[]> {
        // In a real app, use @xenova/transformers or an API
        // For now, deterministic mock based on text hash
        const vec = new Array(384).fill(0).map((_, i) => {
            let hash = 0;
            for (let j = 0; j < text.length; j++) {
                hash = (hash << 5) - hash + text.charCodeAt(j);
                hash |= 0;
            }
            return Math.sin(hash + i);
        });
        return vec;
    }

    async addChunks(chunks: CodeChunk[]) {
        if (!this.db) throw new Error('Database not initialized');
        if (chunks.length === 0) return;

        const dataWithVectors = await Promise.all(chunks.map(async chunk => ({
            vector: await this.getEmbedding(chunk.content),
            filePath: chunk.filePath,
            content: chunk.content,
            lineStart: chunk.metadata.lineStart,
            lineEnd: chunk.metadata.lineEnd,
            type: chunk.metadata.type
        })));

        if (!this.table) {
            this.table = await this.db.createTable('code_chunks', dataWithVectors);
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
                await this.table.delete(`filePath = "${filePath}"`);
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
        const queryVector = await this.getEmbedding(query);
        const results = await this.table.vectorSearch(queryVector).limit(limit).toArray();
        return results;
    }

    async clear() {
        if (this.db) {
            try {
                await this.db.dropTable('code_chunks');
                this.table = null;
            } catch (e) {}
        }
    }
}
