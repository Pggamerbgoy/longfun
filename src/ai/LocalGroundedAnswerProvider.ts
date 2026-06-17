import * as path from 'path';
import { AnswerContext, AnswerProvider } from './AnswerProvider';

export class LocalGroundedAnswerProvider implements AnswerProvider {
    readonly name = 'local-grounded-summary';

    async isConfigured(): Promise<boolean> {
        return true;
    }

    async answer(context: AnswerContext): Promise<string> {
        if (context.chunks.length === 0) {
            return [
                `I could not find indexed code for "${context.query}".`,
                '',
                'Try running AI Memory: Reindex Workspace, then ask again.'
            ].join('\n');
        }

        const lines: string[] = [
            `Grounded local answer for "${context.query}"`,
        ];

        if (context.projectMapContext) {
            lines.push('');
            lines.push(context.projectMapContext);
        }

        lines.push('');
        lines.push('I found these relevant code areas:');

        context.chunks.forEach((chunk, index) => {
            const fileName = path.basename(chunk.filePath);
            const preview = chunk.content.trim().slice(0, 400);
            lines.push('');
            lines.push(`**${index + 1}. ${fileName} (Lines ${chunk.lineStart}-${chunk.lineEnd})**`);
            lines.push('```');
            lines.push(preview + (chunk.content.length > 400 ? '\n...' : ''));
            lines.push('```');
        });

        if (context.graphContext) {
            lines.push('');
            lines.push('Dependency context:');
            lines.push(context.graphContext);
        }

        lines.push('');
        lines.push('Prompt/context that would be sent to Gemini:');
        lines.push('```');
        lines.push(context.optimizedPrompt);
        lines.push('```');

        return lines.join('\n');
    }
}
