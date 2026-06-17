import * as fs from 'fs';
import * as path from 'path';
import { ASTManager } from '../graph/ASTManager';
import { CodeChunk, VectorStore } from '../memory/VectorStore';

export interface IndexStatus {
    isIndexing: boolean;
    indexedFiles: number;
    skippedFiles: number;
    totalFiles: number;
    lastIndexedAt?: string;
    lastError?: string;
    embeddingProvider?: string;
}

export interface WorkspaceIndexOptions {
    force?: boolean;
    onProgress?: (status: IndexStatus, currentFile?: string) => void;
}

export interface IndexFileOptions {
    force?: boolean;
}

interface IndexedFileState {
    mtimeMs: number;
    size: number;
}

export class WorkspaceIndexService {
    private readonly supportedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);
    private readonly ignoredDirectories = new Set([
        'node_modules',
        '.git',
        'dist',
        'out',
        'build',
        '.ai-memory-db',
        '.npm-cache',
        '.vscode-test',
        '.pytest_cache',
        '.ruff_cache',
        '.mypy_cache',
        '.claude',
        '.claude-flow',
        '.swarm',
        '.agent',
        'logs',
        'data',
        'screenshots',
        'tmp',
        'whatsapp_session',
        '__pycache__'
    ]);
    private status: IndexStatus = {
        isIndexing: false,
        indexedFiles: 0,
        skippedFiles: 0,
        totalFiles: 0
    };
    private indexedFileState = new Map<string, IndexedFileState>();

    constructor(
        private readonly workspaceRoot: string,
        private readonly astManager: ASTManager,
        private readonly vectorStore: VectorStore,
        private readonly maxFileSizeBytes: number = 512 * 1024
    ) { }

    async indexWorkspace(options: WorkspaceIndexOptions = {}): Promise<IndexStatus> {
        if (this.status.isIndexing) {
            return this.getStatus();
        }

        this.status = {
            isIndexing: true,
            indexedFiles: 0,
            skippedFiles: 0,
            totalFiles: 0,
            embeddingProvider: await this.vectorStore.getEmbeddingProviderName()
        };

        try {
            const files = await this.collectFiles(this.workspaceRoot);
            this.status.totalFiles = files.length;

            if (options.force) {
                this.astManager.clear();
                await this.vectorStore.clear();
                this.indexedFileState.clear();
            }

            await this.deleteMissingFiles(files);

            for (const file of files) {
                const indexed = await this.indexFile(file, { force: options.force });
                if (indexed) {
                    this.status.indexedFiles++;
                } else {
                    this.status.skippedFiles++;
                }
                options.onProgress?.(this.getStatus(), file);
            }

            this.status.isIndexing = false;
            this.status.lastIndexedAt = new Date().toISOString();
            this.status.embeddingProvider = await this.vectorStore.getEmbeddingProviderName();
            return this.getStatus();
        } catch (error) {
            this.status.isIndexing = false;
            this.status.lastError = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }

    async indexFile(filePath: string, options: IndexFileOptions = {}): Promise<boolean> {
        if (!this.shouldIndexFile(filePath)) {
            return false;
        }

        const resolvedFilePath = path.resolve(filePath);
        const stat = await fs.promises.stat(resolvedFilePath);
        if (stat.size > this.maxFileSizeBytes) {
            return false;
        }

        if (!options.force && !this.hasFileChanged(resolvedFilePath, stat)) {
            return false;
        }

        const content = await fs.promises.readFile(resolvedFilePath, 'utf8');
        await this.astManager.parseFile(resolvedFilePath, content);
        await this.vectorStore.upsert(resolvedFilePath, this.chunkCode(resolvedFilePath, content));
        this.indexedFileState.set(resolvedFilePath, {
            mtimeMs: stat.mtimeMs,
            size: stat.size
        });
        return true;
    }

    async deleteFile(filePath: string): Promise<void> {
        const resolvedFilePath = path.resolve(filePath);
        this.astManager.deleteFile(resolvedFilePath);
        await this.vectorStore.deleteFile(resolvedFilePath);
        this.indexedFileState.delete(resolvedFilePath);
    }

    getStatus(): IndexStatus {
        return { ...this.status };
    }

    shouldIndexFile(filePath: string): boolean {
        const resolved = path.resolve(filePath);
        const relative = path.relative(path.resolve(this.workspaceRoot), resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return false;
        }

        if (!this.supportedExtensions.has(path.extname(resolved))) {
            return false;
        }

        const relativeParts = path.relative(this.workspaceRoot, resolved).split(path.sep);
        return !relativeParts.some(part => this.ignoredDirectories.has(part));
    }

    private hasFileChanged(filePath: string, stat: fs.Stats): boolean {
        const previous = this.indexedFileState.get(filePath);
        return !previous || previous.mtimeMs !== stat.mtimeMs || previous.size !== stat.size;
    }

    private async deleteMissingFiles(currentFiles: string[]): Promise<void> {
        const current = new Set(currentFiles.map(file => path.resolve(file)));
        for (const indexedFile of [...this.indexedFileState.keys()]) {
            if (!current.has(indexedFile)) {
                await this.deleteFile(indexedFile);
            }
        }
    }

    private async collectFiles(directory: string, files: string[] = []): Promise<string[]> {
        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(directory, { withFileTypes: true });
        } catch (error) {
            this.status.skippedFiles++;
            console.warn(`AI Memory skipped unreadable directory ${directory}:`, error);
            return files;
        }

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                if (!this.ignoredDirectories.has(entry.name)) {
                    await this.collectFiles(fullPath, files);
                }
            } else if (entry.isFile() && this.shouldIndexFile(fullPath)) {
                files.push(fullPath);
            }
        }

        return files;
    }

    private chunkCode(filePath: string, content: string): CodeChunk[] {
        const lines = content.split('\n');
        const chunks: CodeChunk[] = [];
        const minChunkSize = 30;
        const maxChunkSize = 60;

        let i = 0;
        while (i < lines.length) {
            let end = i + minChunkSize;

            // Try to find a good breaking point (empty line, closing brace, or 0-indent line)
            if (end < lines.length) {
                let foundBreak = false;
                for (let j = end; j < Math.min(i + maxChunkSize, lines.length); j++) {
                    const line = lines[j];
                    if (line.trim() === '' || line.startsWith('}') || (line.trim().length > 0 && !/^\s/.test(line))) {
                        end = j + 1;
                        foundBreak = true;
                        break;
                    }
                }
                if (!foundBreak) {
                    end = Math.min(i + maxChunkSize, lines.length);
                }
            } else {
                end = lines.length;
            }

            const chunkLines = lines.slice(i, end);
            const contentChunk = chunkLines.join('\n');
            if (contentChunk.trim().length > 0) {
                chunks.push({
                    filePath,
                    content: contentChunk,
                    metadata: {
                        lineStart: i + 1,
                        lineEnd: end,
                        type: 'chunk'
                    }
                });
            }
            i = end;
        }

        return chunks;
    }
}
