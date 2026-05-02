import * as vscode from 'vscode';
import * as path from 'path';
import { ASTManager } from './graph/ASTManager';
import { VectorStore } from './memory/VectorStore';
import { ContinuousDiffEngine } from './mechanics/ContinuousDiffEngine';
import { BrainManager } from './brain/BrainManager';

export async function activate(context: vscode.ExtensionContext) {
    console.log('AI Memory OS is now active!');

    // Initialize core components
    const astManager = new ASTManager();
    
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || context.globalStorageUri.fsPath;
    const vectorStore = new VectorStore(workspaceRoot);
    const brain = new BrainManager(vectorStore, astManager);
    const diffEngine = new ContinuousDiffEngine(astManager, vectorStore);

    // Initialize the DB
    await vectorStore.init();

    // Start watching files
    diffEngine.startWatching();

    let startDisposable = vscode.commands.registerCommand('aiMemory.start', () => {
        vscode.window.showInformationMessage('AI Memory OS Started: Background indexing active.');
    });

    let askDisposable = vscode.commands.registerCommand('aiMemory.ask', async () => {
        const query = await vscode.window.showInputBox({ prompt: 'Ask a question about your codebase...' });
        if (!query) return;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "AI Memory is thinking...",
            cancellable: false
        }, async () => {
            const answer = await brain.ask(query);
            // Show answer in an output channel or markdown preview
            const channel = vscode.window.createOutputChannel("AI Memory Answer");
            channel.appendLine(answer);
            channel.show();
        });
    });

    let impactDisposable = vscode.commands.registerCommand('aiMemory.analyzeImpact', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active file to analyze impact.');
            return;
        }
        
        const impact = await astManager.analyzeImpact(editor.document.uri.fsPath);
        const fileNames = impact.map(f => path.basename(f)).join(', ');
        vscode.window.showInformationMessage(`Impact Analysis: ${impact.length} files affected: ${fileNames}`);
    });

    let graphDisposable = vscode.commands.registerCommand('aiMemory.showGraph', () => {
        const panel = vscode.window.createWebviewPanel(
            'aiMemoryGraph',
            'Project Dependency Graph',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const mermaidGraph = astManager.generateMermaidGraph();
        
        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
                <style>
                    body { background: #1e1e1e; color: white; display: flex; flex-direction: column; align-items: center; padding: 20px; font-family: sans-serif; }
                    .mermaid { background: white; padding: 20px; border-radius: 8px; }
                </style>
            </head>
            <body>
                <h2>Project Dependency Graph</h2>
                <pre class="mermaid">
                    ${mermaidGraph}
                </pre>
                <script>
                    mermaid.initialize({ startOnLoad: true, theme: 'default' });
                </script>
            </body>
            </html>
        `;
    });

    context.subscriptions.push(startDisposable, askDisposable, impactDisposable, graphDisposable, diffEngine);
}

export function deactivate() {
    console.log('AI Memory OS deactivated.');
}
