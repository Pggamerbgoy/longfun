import { EmbeddingOptions, EmbeddingProvider, normalizeVector } from './EmbeddingProvider';

export class LocalKeywordEmbeddingProvider implements EmbeddingProvider {
    readonly name = 'local-keyword-768';
    readonly dimensions: number;
    private readonly stopWords = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'codebase', 'does', 'for', 'from',
        'handle', 'how', 'in', 'is', 'it', 'makima', 'of', 'on', 'or', 'project',
        'the', 'this', 'to', 'with'
    ]);

    constructor(dimensions: number = 768) {
        this.dimensions = dimensions;
    }

    async embed(text: string, _options?: EmbeddingOptions): Promise<number[]> {
        const vector = new Array(this.dimensions).fill(0);
        const tokens = this.tokenize(text);

        for (const token of tokens) {
            const hash = this.hash(token);
            const index = Math.abs(hash) % this.dimensions;
            const sign = hash % 2 === 0 ? 1 : -1;
            vector[index] += sign * this.weight(token);
        }

        return normalizeVector(vector, this.dimensions);
    }

    private tokenize(text: string): string[] {
        const normalized = text
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]/g, ' ')
            .toLowerCase();

        const tokens: string[] = normalized.match(/[a-z0-9]+/g) ?? [];

        if (normalized.includes('speech to text') || normalized.includes('voice input')) {
            tokens.push('stt', 'transcription');
        }
        if (normalized.includes('text to speech') || normalized.includes('voice output')) {
            tokens.push('tts', 'synthesis');
        }

        return tokens.filter(token => !this.stopWords.has(token));
    }

    private weight(token: string): number {
        if (token.length <= 2) {
            return 0.25;
        }
        if (token.length <= 5) {
            return 0.75;
        }
        return 1;
    }

    private hash(value: string): number {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash | 0;
    }
}
