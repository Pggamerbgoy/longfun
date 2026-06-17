import * as vscode from 'vscode';
import { WorkspaceIndexService } from '../indexing/WorkspaceIndexService';

export class ContinuousDiffEngine implements vscode.Disposable {
    private fileSystemWatcher: vscode.FileSystemWatcher | undefined;
    private debounceTimers = new Map<string, NodeJS.Timeout>();

    constructor(private readonly indexService: WorkspaceIndexService) {}

    startWatching() {
        // Watch for all file saves in the workspace
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');

        this.fileSystemWatcher.onDidCreate(async (uri) => {
            this.handleFileChange(uri);
        });
        this.fileSystemWatcher.onDidChange(async (uri) => {
            this.handleFileChange(uri);
        });
        this.fileSystemWatcher.onDidDelete(async (uri) => {
            await this.indexService.deleteFile(uri.fsPath);
            vscode.window.setStatusBarMessage('$(trash) AI Memory: Removed deleted file', 2000);
        });

        console.log('ContinuousDiffEngine is watching for file changes.');
    }

    private handleFileChange(uri: vscode.Uri) {
        const filePath = uri.fsPath;
        if (!this.indexService.shouldIndexFile(filePath)) {
            return;
        }

        // Debounce to prevent multiple triggers for rapid saves on the same file
        if (this.debounceTimers.has(filePath)) {
            clearTimeout(this.debounceTimers.get(filePath));
        }

        const timer = setTimeout(async () => {
            try {
                this.debounceTimers.delete(filePath);
                console.log(`Detected change in ${filePath}, updating Memory...`);

                await this.indexService.indexFile(filePath);
                vscode.window.setStatusBarMessage('$(sync~spin) AI Memory: Updated context', 2000);
            } catch (err) {
                console.error(`Error updating memory for ${filePath}:`, err);
            }
        }, 2000); // 2 second debounce

        this.debounceTimers.set(filePath, timer);
    }

    dispose() {
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
        }
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}
