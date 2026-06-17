export interface AnswerContextChunk {
    filePath: string;
    content: string;
    lineStart: number;
    lineEnd: number;
    type: string;
}

export interface AnswerContext {
    query: string;
    chunks: AnswerContextChunk[];
    projectMapContext?: string;
    graphContext: string;
    optimizedPrompt: string;
}

export interface AnswerProvider {
    readonly name: string;
    isConfigured(): Promise<boolean>;
    answer(context: AnswerContext): Promise<string>;
}

export class AnswerProviderNotConfiguredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AnswerProviderNotConfiguredError';
    }
}
