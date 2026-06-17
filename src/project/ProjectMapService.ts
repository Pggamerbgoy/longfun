import * as path from 'path';
import { AnswerContextChunk } from '../ai/AnswerProvider';
import { ASTManager } from '../graph/ASTManager';

export interface ProjectMapEntry {
    path: string;
    kind: 'directory' | 'file';
    fileCount: number;
    purpose: string;
    importantFiles: string[];
}

export interface WorkspaceProjectMap {
    summary: string;
    entries: ProjectMapEntry[];
}

export interface RelevantProjectMap {
    summary: string;
    targetFiles: string[];
    relatedFiles: string[];
    impactedFiles: string[];
    structure: string[];
    suggestedChecks: string[];
}

export class ProjectMapService {
    constructor(
        private readonly workspaceRoot: string,
        private readonly astManager: ASTManager
    ) {}

    buildWorkspaceMap(maxEntries: number = 12): WorkspaceProjectMap {
        const indexedFiles = this.astManager.getIndexedFiles();
        const groups = new Map<string, string[]>();

        for (const filePath of indexedFiles) {
            const relativePath = this.toRelative(filePath);
            const parts = relativePath.split('/');
            const key = parts.length > 1 ? `${parts[0]}/` : relativePath;
            groups.set(key, [...(groups.get(key) || []), relativePath]);
        }

        const entries = [...groups.entries()]
            .map(([groupPath, files]) => ({
                path: groupPath,
                kind: groupPath.endsWith('/') ? 'directory' as const : 'file' as const,
                fileCount: files.length,
                purpose: this.inferPurpose(groupPath),
                importantFiles: this.pickImportantFiles(files)
            }))
            .sort((a, b) => b.fileCount - a.fileCount || a.path.localeCompare(b.path))
            .slice(0, maxEntries);

        return {
            summary: `${indexedFiles.length} indexed source file(s) grouped into ${groups.size} top-level area(s).`,
            entries
        };
    }

    async buildRelevantMap(
        query: string,
        chunks: AnswerContextChunk[] = [],
        maxFiles: number = 12
    ): Promise<RelevantProjectMap> {
        const fileMatches = this.astManager.findFilesInQuery(query, 4);
        const targetFiles = fileMatches.length > 0
            ? fileMatches
            : this.unique(chunks.slice(0, 3).map(chunk => chunk.filePath));
        const relatedFiles: string[] = [];
        const impactedFiles: string[] = [];

        for (const filePath of targetFiles) {
            const impact = await this.astManager.getFileImpact(filePath);
            relatedFiles.push(
                ...impact.imports.filter(file => this.astManager.isIndexedFile(file)),
                ...impact.directDependents
            );
            impactedFiles.push(...impact.impactedFiles.filter(file => file !== impact.filePath));
        }

        chunks.slice(0, maxFiles).forEach(chunk => {
            if (!targetFiles.includes(chunk.filePath)) {
                relatedFiles.push(chunk.filePath);
            }
        });

        const targetRelative = this.toRelativeList(targetFiles).slice(0, maxFiles);
        const relatedRelative = this.toRelativeList(this.unique(relatedFiles))
            .filter(file => !targetRelative.includes(file))
            .slice(0, maxFiles);
        const impactedRelative = this.toRelativeList(this.unique(impactedFiles))
            .filter(file => !targetRelative.includes(file))
            .slice(0, maxFiles);

        return {
            summary: `Compact project context for "${query}": ${targetRelative.length} target file(s), ${relatedRelative.length} related file(s), ${impactedRelative.length} impacted file(s).`,
            targetFiles: targetRelative,
            relatedFiles: relatedRelative,
            impactedFiles: impactedRelative,
            structure: this.buildRelevantStructure([...targetRelative, ...relatedRelative, ...impactedRelative]),
            suggestedChecks: this.buildSuggestedChecks(targetRelative, impactedRelative)
        };
    }

    renderWorkspaceMap(map: WorkspaceProjectMap): string {
        const lines = ['Project Map:', map.summary];
        for (const entry of map.entries) {
            const important = entry.importantFiles.length > 0
                ? `; key: ${entry.importantFiles.join(', ')}`
                : '';
            lines.push(`- ${entry.path} ${entry.purpose} (${entry.fileCount} file${entry.fileCount === 1 ? '' : 's'}${important})`);
        }
        return lines.join('\n');
    }

    renderRelevantMap(map: RelevantProjectMap): string {
        const lines = [
            'Project Map Context:',
            map.summary,
            '',
            'Relevant Structure:',
            ...(map.structure.length > 0 ? map.structure.map(item => `- ${item}`) : ['- none detected']),
            '',
            `Target files: ${map.targetFiles.length > 0 ? map.targetFiles.join(', ') : 'none detected'}`,
            `Related files: ${map.relatedFiles.length > 0 ? map.relatedFiles.join(', ') : 'none detected'}`,
            `Impacted files: ${map.impactedFiles.length > 0 ? map.impactedFiles.join(', ') : 'none detected'}`,
            '',
            'Suggested Checks:',
            ...map.suggestedChecks.map(check => `- ${check}`)
        ];

        return lines.join('\n');
    }

    private buildRelevantStructure(files: string[]): string[] {
        const groups = new Map<string, string[]>();
        for (const file of this.unique(files)) {
            const parts = file.split('/');
            const group = parts.length > 1 ? `${parts[0]}/` : '(root)';
            groups.set(group, [...(groups.get(group) || []), file]);
        }

        return [...groups.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([group, groupFiles]) => `${group}: ${groupFiles.slice(0, 8).join(', ')}`);
    }

    private buildSuggestedChecks(targetFiles: string[], impactedFiles: string[]): string[] {
        const checks = [
            'Inspect target public functions/classes before editing.',
            'Review direct users before changing return types or side effects.'
        ];
        const testFiles = impactedFiles.filter(file => /(^|\/)(tests?|specs?)\//i.test(file) || /test|spec/i.test(path.basename(file)));
        const scriptFiles = impactedFiles.filter(file => /(^|\/)scripts?\//i.test(file) || /(^|\/)scratch\//i.test(file));

        if (testFiles.length > 0) {
            checks.push(`Run/review impacted tests: ${testFiles.slice(0, 6).join(', ')}.`);
        }
        if (scriptFiles.length > 0) {
            checks.push(`Check manual/demo flows: ${scriptFiles.slice(0, 4).join(', ')}.`);
        }
        if (targetFiles.length > 0) {
            checks.push(`Ask for snippets only from these target files first: ${targetFiles.slice(0, 4).join(', ')}.`);
        }

        return checks;
    }

    private pickImportantFiles(files: string[]): string[] {
        return files
            .filter(file => /(^|\/)(index|main|app|extension|cli|server|test|config)[._-]/i.test(file) || /test|spec/i.test(path.basename(file)))
            .slice(0, 5);
    }

    private inferPurpose(groupPath: string): string {
        const name = groupPath.replace(/\/$/, '').toLowerCase();
        if (name === 'core') return 'core engines/runtime';
        if (name === 'ui' || name === 'views' || name === 'components') return 'user interface';
        if (name === 'test' || name === 'tests' || name === '__tests__') return 'automated checks';
        if (name === 'script' || name === 'scripts' || name === 'scratch') return 'manual/dev flows';
        if (name === 'src') return 'extension/application source';
        if (name.includes('agent')) return 'agent behavior';
        if (name.includes('memory')) return 'memory/indexing';
        if (name.includes('graph')) return 'dependency graph';
        if (name.includes('config')) return 'configuration';
        if (name.includes('doc')) return 'documentation';
        return 'source area';
    }

    private toRelativeList(files: string[]): string[] {
        return files.map(file => this.toRelative(file));
    }

    private toRelative(filePath: string): string {
        return path.relative(this.workspaceRoot, path.resolve(filePath)).replace(/\\/g, '/');
    }

    private unique(values: string[]): string[] {
        return [...new Set(values.filter(Boolean))];
    }
}
