import { GoogleGenAI } from '@google/genai';
import { EmbeddingNotConfiguredError, EmbeddingOptions, EmbeddingProvider, normalizeVector } from './EmbeddingProvider';

type SecretReader = () => Promise<string | undefined>;
type SettingReader<T> = () => T;

export class GeminiEmbeddingProvider implements EmbeddingProvider {
    readonly name = 'gemini-embedding-001';
    private client: GoogleGenAI | null = null;
    private clientKey: string | null = null;

    constructor(
        private readonly getApiKey: SecretReader,
        private readonly getModel: SettingReader<string>,
        private readonly getDimensions: SettingReader<number>
    ) {}

    get dimensions(): number {
        return this.getDimensions();
    }

    async isConfigured(): Promise<boolean> {
        const key = await this.getApiKey();
        return Boolean(key && key.trim().length > 0);
    }

    async embed(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new EmbeddingNotConfiguredError('Gemini API key is not configured.');
        }

        const response = await this.getClient(apiKey).models.embedContent({
            model: this.getModel(),
            contents: this.trimForEmbedding(text),
            config: {
                outputDimensionality: this.dimensions,
                taskType: options.taskType,
                title: options.title
            }
        });

        const values = response.embeddings?.[0]?.values;
        if (!values || values.length === 0) {
            throw new Error('Gemini returned an empty embedding.');
        }

        return normalizeVector(values, this.dimensions);
    }

    private getClient(apiKey: string): GoogleGenAI {
        if (!this.client || this.clientKey !== apiKey) {
            this.client = new GoogleGenAI({ apiKey });
            this.clientKey = apiKey;
        }
        return this.client;
    }

    private trimForEmbedding(text: string): string {
        const maxChars = 8000;
        return text.length > maxChars ? text.slice(0, maxChars) : text;
    }
}
