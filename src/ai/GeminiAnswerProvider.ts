import { GoogleGenAI } from '@google/genai';
import { AnswerContext, AnswerProvider, AnswerProviderNotConfiguredError } from './AnswerProvider';

type SecretReader = () => Promise<string | undefined>;
type SettingReader<T> = () => T;

export class GeminiAnswerProvider implements AnswerProvider {
    readonly name = 'gemini';
    private client: GoogleGenAI | null = null;
    private clientKey: string | null = null;

    constructor(
        private readonly getApiKey: SecretReader,
        private readonly getModel: SettingReader<string>
    ) {}

    async isConfigured(): Promise<boolean> {
        const key = await this.getApiKey();
        return Boolean(key && key.trim().length > 0);
    }

    async answer(context: AnswerContext): Promise<string> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new AnswerProviderNotConfiguredError('Gemini API key is not configured.');
        }

        const response = await this.getClient(apiKey).models.generateContent({
            model: this.getModel(),
            contents: this.buildPrompt(context)
        });

        return response.text?.trim() || 'Gemini returned an empty answer.';
    }

    private getClient(apiKey: string): GoogleGenAI {
        if (!this.client || this.clientKey !== apiKey) {
            this.client = new GoogleGenAI({ apiKey });
            this.clientKey = apiKey;
        }
        return this.client;
    }

    private buildPrompt(context: AnswerContext): string {
        return [
            'You are AI Memory OS, a local codebase memory assistant inside VS Code.',
            'Answer the user using only the grounded code context below.',
            'Cite files and line ranges when you make claims.',
            'If the context is insufficient, say what is missing instead of guessing.',
            '',
            `User question: ${context.query}`,
            '',
            context.projectMapContext ? `COMPACT PROJECT MAP:\n${context.projectMapContext}\n` : '',
            context.optimizedPrompt,
            context.graphContext ? `\nDEPENDENCY / IMPACT CONTEXT:\n${context.graphContext}` : ''
        ].join('\n');
    }
}
