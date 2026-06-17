import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LocalGroundedAnswerProvider } from './ai/LocalGroundedAnswerProvider';
import { LocalKeywordEmbeddingProvider } from './ai/LocalKeywordEmbeddingProvider';
import { TransformersEmbeddingProvider } from './ai/TransformersEmbeddingProvider';
import { HybridEmbeddingProvider } from './ai/HybridEmbeddingProvider';
import { BrainManager } from './brain/BrainManager';
import { ASTManager } from './graph/ASTManager';
import { AiMemoryMcpTools } from './mcp/AiMemoryMcpTools';
import { VectorStore } from './memory/VectorStore';
import { ProjectMapService } from './project/ProjectMapService';

console.log = (...args: unknown[]) => console.error(...args);

const supportedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);
const ignoredDirectories = new Set([
    'node_modules',
    '.git',
    'dist',
    'out',
    'build',
    '.ai-memory-db',
    '.ai-memory-model-cache',
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

export async function createMcpToolsFromWorkspace(workspaceRoot: string): Promise<AiMemoryMcpTools> {
    const resolvedWorkspace = path.resolve(workspaceRoot);
    const astManager = new ASTManager(resolvedWorkspace);
    await astManager.init();
    await hydrateGraph(astManager, resolvedWorkspace);

    const transformerEmbedding = new TransformersEmbeddingProvider(
        () => 'Xenova/all-MiniLM-L6-v2',
        () => 384,
        () => path.join(os.homedir(), '.cache', 'ai-memory-extension', 'transformers')
    );
    const vectorStore = new VectorStore(
        resolvedWorkspace,
        new HybridEmbeddingProvider(transformerEmbedding, new LocalKeywordEmbeddingProvider(384))
    );
    await vectorStore.init();

    const brain = new BrainManager(vectorStore, astManager, new LocalGroundedAnswerProvider());
    const projectMapService = new ProjectMapService(resolvedWorkspace, astManager);
    return new AiMemoryMcpTools(resolvedWorkspace, astManager, vectorStore, brain, projectMapService);
}

async function main() {
    const workspace = readArg('--workspace') || process.env.WORKSPACE || process.cwd();
    const tools = await createMcpToolsFromWorkspace(workspace);
    const server = new McpServer({
        name: 'ai-memory-os',
        version: '1.0.0'
    });

    const textResult = (text: string) => ({
        content: [{ type: 'text' as const, text }]
    });

    server.registerTool(
        'ai_memory_status',
        {
            title: 'AI Memory Status',
            description: 'Show index, graph, and embedding provider status for the workspace.'
        },
        async () => textResult(await tools.statusText())
    );

    server.registerTool(
        'ai_memory_project_map',
        {
            title: 'AI Memory Project Map',
            description: 'Return a compact workspace map, or a query-focused relevant structure map.',
            inputSchema: z.object({
                query: z.string().optional(),
                maxTokens: z.number().int().positive().max(8000).optional()
            })
        },
        async ({ query, maxTokens }) => textResult(await tools.projectMapText(query, maxTokens))
    );

    server.registerTool(
        'ai_memory_search',
        {
            title: 'AI Memory Search',
            description: 'Search indexed memory and return bounded snippets plus related/impacted files.',
            inputSchema: z.object({
                query: z.string().min(1),
                maxTokens: z.number().int().positive().max(8000).optional()
            })
        },
        async ({ query, maxTokens }) => textResult(await tools.searchText(query, maxTokens))
    );

    server.registerTool(
        'ai_memory_impact',
        {
            title: 'AI Memory Impact',
            description: 'Resolve a file name/path from a query and return direct users, affected files, and checks.',
            inputSchema: z.object({
                fileOrQuery: z.string().min(1),
                maxTokens: z.number().int().positive().max(8000).optional()
            })
        },
        async ({ fileOrQuery, maxTokens }) => textResult(await tools.impactText(fileOrQuery, maxTokens))
    );

    server.registerTool(
        'ai_memory_answer',
        {
            title: 'AI Memory Answer',
            description: 'Return a grounded local answer using compact project map, graph impact, and snippets.',
            inputSchema: z.object({
                query: z.string().min(1),
                maxTokens: z.number().int().positive().max(12000).optional()
            })
        },
        async ({ query, maxTokens }) => textResult(await tools.answerText(query, maxTokens))
    );

    await server.connect(new StdioServerTransport());
}

async function hydrateGraph(astManager: ASTManager, workspaceRoot: string): Promise<void> {
    const files = await collectSourceFiles(workspaceRoot, workspaceRoot);
    for (const file of files) {
        try {
            await astManager.parseFile(file, await fs.promises.readFile(file, 'utf8'));
        } catch (error) {
            console.warn(`AI Memory MCP skipped ${file}:`, error);
        }
    }
}

async function collectSourceFiles(workspaceRoot: string, directory: string, files: string[] = []): Promise<string[]> {
    let entries: fs.Dirent[];
    try {
        entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch (error) {
        console.warn(`AI Memory MCP skipped unreadable directory ${directory}:`, error);
        return files;
    }

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (!ignoredDirectories.has(entry.name)) {
                await collectSourceFiles(workspaceRoot, fullPath, files);
            }
            continue;
        }

        if (!entry.isFile() || !supportedExtensions.has(path.extname(fullPath))) {
            continue;
        }

        const stat = await fs.promises.stat(fullPath);
        if (stat.size <= 512 * 1024 && path.resolve(fullPath).startsWith(workspaceRoot)) {
            files.push(fullPath);
        }
    }

    return files;
}

function readArg(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    if (index === -1) return undefined;
    return process.argv[index + 1];
}

if (require.main === module) {
    main().catch(error => {
        console.error('AI Memory MCP server failed:', error);
        process.exit(1);
    });
}
