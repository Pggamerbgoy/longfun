import * as fs from 'fs';
import { EmbeddingOptions, EmbeddingProvider, normalizeVector } from './EmbeddingProvider';

type PipelineFactory = (task: string, model: string) => Promise<FeatureExtractionPipeline>;
type FeatureExtractionPipeline = (input: string, options: Record<string, unknown>) => Promise<TensorLike>;

interface TensorLike {
    data?: Iterable<number>;
    dims?: number[];
    tolist?: () => unknown;
}

const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

export class TransformersEmbeddingProvider implements EmbeddingProvider {
    constructor(
        private readonly getModel: () => string = () => 'Xenova/all-MiniLM-L6-v2',
        private readonly getDimensions: () => number = () => 384,
        private readonly getCacheDir?: () => string | undefined
    ) {}

    get name(): string {
        return `transformers:${this.getModel()}`;
    }

    get dimensions(): number {
        return this.getDimensions();
    }

    private extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

    async embed(text: string, _options: EmbeddingOptions = {}): Promise<number[]> {
        const extractor = await this.getExtractor();
        const output = await extractor(this.trimForEmbedding(text), {
            pooling: 'mean',
            normalize: true
        });

        return normalizeVector(this.tensorToVector(output), this.dimensions);
    }

    private async getExtractor(): Promise<FeatureExtractionPipeline> {
        if (!this.extractorPromise) {
            this.extractorPromise = this.loadExtractor();
        }

        return this.extractorPromise;
    }

    private async loadExtractor(): Promise<FeatureExtractionPipeline> {
        const transformers = await dynamicImport('@huggingface/transformers');
        const cacheDir = this.getCacheDir?.();

        if (cacheDir) {
            fs.mkdirSync(cacheDir, { recursive: true });
            transformers.env.cacheDir = cacheDir;
        }

        const pipeline = transformers.pipeline as PipelineFactory;
        return pipeline('feature-extraction', this.getModel());
    }

    private tensorToVector(output: TensorLike): number[] {
        if (output.tolist) {
            const list = output.tolist();
            if (Array.isArray(list)) {
                return this.flattenFirstVector(list);
            }
        }

        if (output.data) {
            return Array.from(output.data).slice(0, this.dimensions);
        }

        throw new Error('Transformers.js returned an embedding without tensor data.');
    }

    private flattenFirstVector(value: unknown): number[] {
        if (!Array.isArray(value)) {
            return [];
        }

        if (value.every(item => typeof item === 'number')) {
            return value as number[];
        }

        return this.flattenFirstVector(value[0]);
    }

    private trimForEmbedding(text: string): string {
        const maxChars = 8000;
        return text.length > maxChars ? text.slice(0, maxChars) : text;
    }
}
