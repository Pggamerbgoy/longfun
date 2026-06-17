import * as vscode from 'vscode';
import * as path from 'path';
import { ASTManager } from './graph/ASTManager';
import { VectorStore } from './memory/VectorStore';
import { ContinuousDiffEngine } from './mechanics/ContinuousDiffEngine';
import { BrainManager } from './brain/BrainManager';
import { LocalKeywordEmbeddingProvider } from './ai/LocalKeywordEmbeddingProvider';
import { TransformersEmbeddingProvider } from './ai/TransformersEmbeddingProvider';
import { HybridEmbeddingProvider } from './ai/HybridEmbeddingProvider';
import { GeminiAnswerProvider } from './ai/GeminiAnswerProvider';
import { WorkspaceIndexService } from './indexing/WorkspaceIndexService';
import { ProjectMapService } from './project/ProjectMapService';

const GEMINI_SECRET_KEY = 'aiMemory.geminiApiKey';

export async function activate(context: vscode.ExtensionContext) {
    console.log('AI Memory OS is now active!');

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.globalStorageUri.fsPath;
    const getConfig = () => vscode.workspace.getConfiguration('aiMemory');
    const getGeminiModel = () => getConfig().get<string>('geminiModel', 'gemini-2.5-flash');
    const getEmbeddingModel = () => getConfig().get<string>('embeddingModel', 'Xenova/all-MiniLM-L6-v2');
    const getEmbeddingDimensions = () => getConfig().get<number>('embeddingDimensions', 384);
    const getMaxFileSizeBytes = () => getConfig().get<number>('maxIndexedFileSizeKb', 512) * 1024;
    const getTransformersCacheDir = () => path.join(context.globalStorageUri.fsPath, 'transformers-cache');
    const getGeminiApiKey = async () => context.secrets.get(GEMINI_SECRET_KEY);

    const astManager = new ASTManager(workspaceRoot);
    await astManager.init();

    const transformerEmbedding = new TransformersEmbeddingProvider(getEmbeddingModel, getEmbeddingDimensions, getTransformersCacheDir);
    const localEmbedding = new LocalKeywordEmbeddingProvider(getEmbeddingDimensions());
    const embeddingProvider = new HybridEmbeddingProvider(transformerEmbedding, localEmbedding);
    const vectorStore = new VectorStore(workspaceRoot, embeddingProvider);
    const geminiAnswerProvider = new GeminiAnswerProvider(getGeminiApiKey, getGeminiModel);
    const brain = new BrainManager(vectorStore, astManager, geminiAnswerProvider);
    const indexService = new WorkspaceIndexService(workspaceRoot, astManager, vectorStore, getMaxFileSizeBytes());
    const projectMapService = new ProjectMapService(workspaceRoot, astManager);
    const diffEngine = new ContinuousDiffEngine(indexService);

    await vectorStore.init();
    diffEngine.startWatching();

    const runWorkspaceIndex = async (force: boolean, title: string) => {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false
        }, async (progress) => {
            const status = await indexService.indexWorkspace({
                force,
                onProgress: (currentStatus, currentFile) => {
                    const increment = currentStatus.totalFiles > 0 ? 100 / currentStatus.totalFiles : 0;
                    const fileName = currentFile ? path.basename(currentFile) : '';
                    progress.report({
                        increment,
                        message: `${currentStatus.indexedFiles}/${currentStatus.totalFiles} ${fileName}`
                    });
                }
            });

            vscode.window.setStatusBarMessage(
                `$(database) AI Memory: indexed ${status.indexedFiles} files`,
                4000
            );
            return status;
        });
    };

    const startDisposable = vscode.commands.registerCommand('aiMemory.start', async () => {
        await runWorkspaceIndex(false, 'AI Memory: Indexing workspace');
        vscode.window.showInformationMessage('AI Memory OS Started: workspace memory is active.');
    });

    const reindexDisposable = vscode.commands.registerCommand('aiMemory.reindexWorkspace', async () => {
        const status = await runWorkspaceIndex(true, 'AI Memory: Reindexing workspace');
        vscode.window.showInformationMessage(`AI Memory reindexed ${status.indexedFiles} files.`);
    });

    const statusDisposable = vscode.commands.registerCommand('aiMemory.showIndexStatus', async () => {
        const status = indexService.getStatus();
        const chunkCount = await vectorStore.getChunkCount();
        const provider = await vectorStore.getEmbeddingProviderName();
        vscode.window.showInformationMessage(
            `AI Memory: ${chunkCount} chunks, ${astManager.getFileCount()} graph files, provider: ${provider}, last index: ${status.lastIndexedAt || 'never'}`
        );
    });

    const setGeminiKeyDisposable = vscode.commands.registerCommand('aiMemory.setGeminiApiKey', async () => {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your Gemini API key',
            password: true,
            ignoreFocusOut: true
        });
        if (!apiKey) return;

        await context.secrets.store(GEMINI_SECRET_KEY, apiKey.trim());
        const action = await vscode.window.showInformationMessage(
            'Gemini API key saved. AI Memory will use Gemini for answer synthesis and local embeddings for memory.',
            'Ask a Question'
        );

        if (action === 'Ask a Question') {
            await vscode.commands.executeCommand('aiMemory.ask');
        }
    });

    const clearGeminiKeyDisposable = vscode.commands.registerCommand('aiMemory.clearGeminiApiKey', async () => {
        await context.secrets.delete(GEMINI_SECRET_KEY);
        vscode.window.showInformationMessage('Gemini API key cleared. AI Memory will keep answering from local grounded memory.');
    });

    const askDisposable = vscode.commands.registerCommand('aiMemory.ask', async () => {
        const query = await vscode.window.showInputBox({ prompt: 'Ask a question about your codebase...' });
        if (!query) return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'AI Memory is thinking...',
            cancellable: false
        }, async () => {
            const answer = await brain.ask(query);
            const channel = vscode.window.createOutputChannel('AI Memory Answer');
            channel.appendLine(answer);
            channel.show();
        });
    });

    const impactDisposable = vscode.commands.registerCommand('aiMemory.analyzeImpact', async () => {
        const editor = vscode.window.activeTextEditor;
        let targetFile = editor?.document.uri.fsPath;

        if (!targetFile) {
            const fileQuery = await vscode.window.showInputBox({
                prompt: 'Enter a file name or path to analyze impact, for example core/stt_engine.py'
            });
            if (!fileQuery) return;

            const matches = astManager.findFilesInQuery(fileQuery, 1);
            targetFile = matches[0];
        }

        if (!targetFile) {
            vscode.window.showErrorMessage('No indexed file matched that name. Run AI Memory: Reindex Workspace, then try again.');
            return;
        }
        
        const impact = await astManager.getFileImpact(targetFile);
        const fileNames = impact.impactedFiles.map(f => astManager.getRelativePath(f)).join(', ');
        vscode.window.showInformationMessage(`Impact Analysis: ${fileNames}`);
    });

    const projectMapDisposable = vscode.commands.registerCommand('aiMemory.showProjectMap', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'Optional: enter a file name or change goal for a focused project map',
            placeHolder: 'core/stt_engine.py fallback change'
        });
        const channel = vscode.window.createOutputChannel('AI Memory Project Map');

        if (query && query.trim().length > 0) {
            const chunks = await vectorStore.search(query, 8);
            const relevantMap = await projectMapService.buildRelevantMap(query, chunks);
            channel.appendLine(projectMapService.renderRelevantMap(relevantMap));
        } else {
            channel.appendLine(projectMapService.renderWorkspaceMap(projectMapService.buildWorkspaceMap()));
        }

        channel.show();
    });

    const graphDisposable = vscode.commands.registerCommand('aiMemory.showGraph', () => {
        const mermaidGraph = astManager.generateMermaidGraph();
        if (mermaidGraph.trim() === 'graph TD') {
            vscode.window.showInformationMessage('AI Memory graph is empty. Run AI Memory: Reindex Workspace first.');
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'aiMemoryGraph',
            'Project Dependency Graph',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        
        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net;">
                <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
                <style>
                    body { background: #0d0d1f; color: #e2e0ff; display: flex; flex-direction: column; align-items: center; padding: 20px; font-family: 'Inter', sans-serif; }
                    .mermaid { background: #141430; padding: 20px; border-radius: 12px; border: 1px solid #1e1e45; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
                    h2 { color: #a78bfa; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.1em; }
                </style>
            </head>
            <body>
                <h2>Project Dependency Graph</h2>
                <div class="mermaid">
                    ${mermaidGraph}
                </div>
                <script>
                    mermaid.initialize({ 
                        startOnLoad: true, 
                        theme: 'dark',
                        themeVariables: {
                            primaryColor: '#a78bfa',
                            primaryTextColor: '#fff',
                            primaryBorderColor: '#7c3aed',
                            lineColor: '#9895c0',
                            secondaryColor: '#1e1e45',
                            tertiaryColor: '#111128'
                        }
                    });
                </script>
            </body>
            </html>
        `;
    });

    context.subscriptions.push(
        startDisposable,
        reindexDisposable,
        statusDisposable,
        setGeminiKeyDisposable,
        clearGeminiKeyDisposable,
        askDisposable,
        impactDisposable,
        projectMapDisposable,
        graphDisposable,
        diffEngine
    );

    if (getConfig().get<boolean>('autoIndexOnStartup', true)) {
        void (async () => {
            try {
                if (await vectorStore.getChunkCount() === 0) {
                    await runWorkspaceIndex(true, 'AI Memory: Initial workspace index');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn('AI Memory startup indexing failed:', message);
                vscode.window.showWarningMessage(`AI Memory startup indexing failed: ${message}`);
            }
        })();
    }

    // Export API for other extensions (like Agent Guardrails Engine) to use
    return {
        getFileImpact: async (filePath: string) => {
            return await astManager.getFileImpact(filePath);
        },
        getProjectMap: () => {
            return projectMapService.buildWorkspaceMap();
        },
        generateMermaidGraph: () => {
            return astManager.generateMermaidGraph();
        },
        askCritic: async (prompt: string) => {
            return await brain.ask(prompt);
        }
    };
}

export function deactivate() {
    console.log('AI Memory OS deactivated.');
}
