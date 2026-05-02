import * as vscode from 'vscode';
import { ASTManager } from '../graph/ASTManager';
import { VectorStore } from '../memory/VectorStore';

export class ContinuousDiffEngine implements vscode.Disposable {
    private fileSystemWatcher: vscode.FileSystemWatcher | undefined;
    private astManager: ASTManager;
    private vectorStore: VectorStore;
    private debounceTimer: NodeJS.Timeout | null = null;

    constructor(astManager: ASTManager, vectorStore: VectorStore) {
        this.astManager = astManager;
        this.vectorStore = vectorStore;
    }

    startWatching() {
        // Watch for all file saves in the workspace
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*.*');

        this.fileSystemWatcher.onDidChange(async (uri) => {
            this.handleFileChange(uri);
        });

        console.log('ContinuousDiffEngine is watching for file changes.');
    }

    private handleFileChange(uri: vscode.Uri) {
        // Ignore node_modules, build, out directories
        if (uri.fsPath.includes('node_modules') || uri.fsPath.includes('out') || uri.fsPath.includes('dist')) {
            return;
        }

        // Debounce to prevent multiple triggers for rapid saves
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const content = document.getText();
                
                console.log(`Detected change in ${uri.fsPath}, updating Memory...`);
                
                // Update Graph
                await this.astManager.parseFile(uri.fsPath, content);
                
                // Update Vector DB
                const chunks = this.chunkCode(uri.fsPath, content);
                await this.vectorStore.upsert(uri.fsPath, chunks);
                
                vscode.window.setStatusBarMessage('$(sync~spin) AI Memory: Updated context', 2000);
            } catch (err) {
                console.error(`Error updating memory for ${uri.fsPath}:`, err);
            }
        }, 2000); // 2 second debounce
    }

    private chunkCode(filePath: string, content: string) {
        const lines = content.split('\n');
        const chunks: any[] = [];
        const chunkSize = 50; // lines per chunk
        
        for (let i = 0; i < lines.length; i += chunkSize) {
            const chunkLines = lines.slice(i, i + chunkSize);
            chunks.push({
                filePath,
                content: chunkLines.join('\n'),
                metadata: {
                    lineStart: i + 1,
                    lineEnd: i + chunkLines.length,
                    type: 'chunk'
                }
            });
        }
        return chunks;
    }

    dispose() {
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
}
