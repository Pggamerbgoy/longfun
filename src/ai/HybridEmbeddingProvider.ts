import { EmbeddingOptions, EmbeddingProvider } from './EmbeddingProvider';

export class HybridEmbeddingProvider implements EmbeddingProvider {
    readonly name = 'hybrid-local-semantic';
    private activeProviderName: string | null = null;
    private warnedFallback = false;

    constructor(
        private readonly primary: EmbeddingProvider,
        private readonly fallback: EmbeddingProvider
    ) {}

    get dimensions(): number {
        return this.primary.dimensions;
    }

    async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
        try {
            const vector = await this.primary.embed(text, options);
            this.activeProviderName = this.primary.name;
            return vector;
        } catch (error) {
            if (!this.warnedFallback) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`AI Memory semantic embeddings unavailable, using keyword fallback: ${message}`);
                this.warnedFallback = true;
            }
            this.activeProviderName = this.fallback.name;
            return this.fallback.embed(text, options);
        }
    }

    async getActiveProviderName(): Promise<string> {
        return this.activeProviderName ?? this.primary.name;
    }
}
