export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY';

export interface EmbeddingOptions {
    taskType?: EmbeddingTaskType;
    title?: string;
}

export interface EmbeddingProvider {
    readonly name: string;
    readonly dimensions: number;
    embed(text: string, options?: EmbeddingOptions): Promise<number[]>;
    getActiveProviderName?(): Promise<string>;
}

export class EmbeddingNotConfiguredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmbeddingNotConfiguredError';
    }
}

export function normalizeVector(values: number[], dimensions: number): number[] {
    const vector = values.slice(0, dimensions);

    while (vector.length < dimensions) {
        vector.push(0);
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) {
        return vector;
    }

    return vector.map(value => value / magnitude);
}
