// import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const Parser = require('web-tree-sitter');

export interface FileImpactSummary {
    filePath: string;
    imports: string[];
    directDependents: string[];
    impactedFiles: string[];
}

export class ASTManager {
    private parser: any = null;
    private dependencyGraph: Map<string, string[]> = new Map();
    private tsLanguage: any = null;
    private jsLanguage: any = null;
    private pythonLanguage: any = null;
    private workspaceRoot: string;

    constructor(workspaceRoot: string = process.cwd()) {
        this.workspaceRoot = path.resolve(workspaceRoot);
    }

    setWorkspaceRoot(workspaceRoot: string) {
        this.workspaceRoot = path.resolve(workspaceRoot);
    }

    getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }

    async init() {
        await Parser.init({
            locateFile: (scriptName: string) => this.resolveWasm(scriptName)
        });
        this.parser = new Parser();
        
        // Load WASM binaries (assuming they are next to the script or in src)
        try {
            this.tsLanguage = await Parser.Language.load(this.resolveWasm('tree-sitter-typescript.wasm'));
            this.jsLanguage = await Parser.Language.load(this.resolveWasm('tree-sitter-javascript.wasm'));
            this.pythonLanguage = await Parser.Language.load(this.resolveWasm('tree-sitter-python.wasm'));
            console.log('ASTManager initialized with Web-Tree-sitter (WASM) for JS/TS/Python.');
        } catch (err) {
            console.error('Failed to load WASM languages:', err);
        }
    }

    private setLanguage(ext: string) {
        if (!this.parser) return;
        
        if (ext === '.ts' || ext === '.tsx') {
            if (this.tsLanguage) this.parser.setLanguage(this.tsLanguage);
        } else if (ext === '.js' || ext === '.jsx') {
            if (this.jsLanguage) this.parser.setLanguage(this.jsLanguage);
        } else if (ext === '.py') {
            if (this.pythonLanguage) this.parser.setLanguage(this.pythonLanguage);
        } else {
            if (this.tsLanguage) this.parser.setLanguage(this.tsLanguage);
        }
    }

    async parseFile(filePath: string, content: string): Promise<void> {
        const normalizedFilePath = path.resolve(filePath);

        if (!this.parser) {
            console.warn('Parser not initialized, calling init()...');
            await this.init();
        }

        try {
            const ext = path.extname(normalizedFilePath);
            this.setLanguage(ext);
            
            const tree = this.parser!.parse(content);
            const imports = this.extractImports(tree.rootNode, ext)
                .map(imp => this.resolveImport(normalizedFilePath, imp))
                .filter(Boolean) as string[];
            
            this.dependencyGraph.set(normalizedFilePath, [...new Set(imports)]);
            console.log(`Parsed ${path.basename(normalizedFilePath)}. Found ${imports.length} imports.`);
        } catch (error) {
            console.error(`Error parsing file ${normalizedFilePath}:`, error);
        }
    }

    private extractImports(rootNode: any, ext: string): string[] {
        const imports: string[] = [];
        
        const traverse = (node: any) => {
            // JS/TS import extraction
            if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
                if (node.type === 'import_statement') {
                    for (const child of node.namedChildren) {
                        if (child.type === 'string' || child.type === 'string_fragment') {
                            imports.push(child.text.replace(/['"]/g, ''));
                        }
                    }
                } else if (node.type === 'call_expression') {
                    if (node.child(0)?.text === 'require' && node.child(1)?.type === 'arguments') {
                        const arg = node.child(1)?.child(1);
                        if (arg && arg.type === 'string') {
                            imports.push(arg.text.replace(/['"]/g, ''));
                        }
                    }
                }
            } 
            // Python import extraction
            else if (ext === '.py') {
                if (node.type === 'import_statement' || node.type === 'import_from_statement') {
                    // In Python tree-sitter:
                    // import_statement -> dotted_name
                    // import_from_statement -> dotted_name
                    for (const child of node.namedChildren) {
                        if (child.type === 'dotted_name' || child.type === 'aliased_import' || child.type === 'relative_import') {
                            imports.push(child.text);
                        }
                    }
                }
            }
            
            for (let i = 0; i < node.childCount; i++) {
                const childNode = node.child(i);
                if (childNode) traverse(childNode);
            }
        };

        traverse(rootNode);
        return [...new Set(imports)];
    }

    async analyzeImpact(filePath: string): Promise<string[]> {
        const targetFile = path.resolve(filePath);
        const affectedFiles = new Set<string>([targetFile]);
        const queue = [targetFile];

        const reverseGraph = new Map<string, string[]>();
        for (const [dependentFile, imports] of this.dependencyGraph.entries()) {
            for (const imp of imports) {
                if (!reverseGraph.has(imp)) reverseGraph.set(imp, []);
                reverseGraph.get(imp)!.push(dependentFile);
            }
        }

        while (queue.length > 0) {
            const currentFile = queue.shift()!;
            const dependents = reverseGraph.get(currentFile) || [];

            for (const dependentFile of dependents) {
                if (affectedFiles.has(dependentFile)) continue;
                affectedFiles.add(dependentFile);
                queue.push(dependentFile);
            }
        }

        return [...affectedFiles];
    }

    async getFileImpact(filePath: string): Promise<FileImpactSummary> {
        const targetFile = path.resolve(filePath);
        return {
            filePath: targetFile,
            imports: this.getImportsForFile(targetFile),
            directDependents: this.getDirectDependents(targetFile),
            impactedFiles: await this.analyzeImpact(targetFile)
        };
    }

    getImportsForFile(filePath: string): string[] {
        return [...(this.dependencyGraph.get(path.resolve(filePath)) || [])];
    }

    getDirectDependents(filePath: string): string[] {
        const targetFile = path.resolve(filePath);
        return [...this.dependencyGraph.entries()]
            .filter(([, imports]) => imports.includes(targetFile))
            .map(([dependentFile]) => dependentFile);
    }

    findFilesInQuery(query: string, limit: number = 5): string[] {
        const normalizedQuery = this.normalizeForSearch(query);
        if (!normalizedQuery) return [];

        const scored = [...this.dependencyGraph.keys()]
            .map(filePath => ({
                filePath,
                score: this.scoreFileMatch(normalizedQuery, filePath)
            }))
            .filter(item => item.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return path.relative(this.workspaceRoot, a.filePath).length - path.relative(this.workspaceRoot, b.filePath).length;
            });

        return scored.slice(0, limit).map(item => item.filePath);
    }

    deleteFile(filePath: string) {
        const normalizedFilePath = path.resolve(filePath);
        this.dependencyGraph.delete(normalizedFilePath);

        for (const [dependentFile, imports] of this.dependencyGraph.entries()) {
            this.dependencyGraph.set(
                dependentFile,
                imports.filter(imp => imp !== normalizedFilePath)
            );
        }
    }

    clear() {
        this.dependencyGraph.clear();
    }

    getFileCount(): number {
        return this.dependencyGraph.size;
    }

    getIndexedFiles(): string[] {
        return [...this.dependencyGraph.keys()];
    }

    isIndexedFile(filePath: string): boolean {
        return this.dependencyGraph.has(path.resolve(filePath));
    }

    getRelativePath(filePath: string): string {
        return path.relative(this.workspaceRoot, path.resolve(filePath)).replace(/\\/g, '/');
    }

    generateMermaidGraph(): string {
        let mermaid = 'graph TD\n';

        for (const [file, imports] of this.dependencyGraph.entries()) {
            const fileName = path.relative(this.workspaceRoot, file).replace(/\\/g, '/');
            const fileId = 'node_' + fileName.replace(/[^a-zA-Z0-9]/g, '_');
            
            mermaid += `  ${fileId}["${fileName}"]\n`;
            
            for (const imp of imports) {
                if (this.dependencyGraph.has(imp)) {
                    const targetName = path.relative(this.workspaceRoot, imp).replace(/\\/g, '/');
                    const targetId = 'node_' + targetName.replace(/[^a-zA-Z0-9]/g, '_');
                    mermaid += `  ${fileId} --> ${targetId}\n`;
                }
            }
        }
        return mermaid;
    }

    private resolveImport(fromFile: string, importPath: string): string | null {
        let basePath: string;

        if (path.isAbsolute(importPath)) {
            basePath = importPath;
        } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
            basePath = path.resolve(path.dirname(fromFile), importPath);
        } else if (importPath.startsWith('.')) {
            const withoutLeadingDots = importPath.replace(/^\.+/, '').replace(/^[/\\]/, '');
            basePath = path.resolve(path.dirname(fromFile), withoutLeadingDots);
        } else {
            basePath = path.join(this.workspaceRoot, importPath.replace(/\./g, path.sep));
        }

        const candidates = [
            basePath,
            `${basePath}.ts`,
            `${basePath}.tsx`,
            `${basePath}.js`,
            `${basePath}.jsx`,
            `${basePath}.py`,
            path.join(basePath, 'index.ts'),
            path.join(basePath, 'index.tsx'),
            path.join(basePath, 'index.js'),
            path.join(basePath, 'index.jsx'),
            path.join(basePath, '__init__.py')
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return path.resolve(candidate);
            }
        }

        return path.resolve(basePath);
    }

    private normalizeForSearch(value: string): string {
        return value
            .replace(/\\/g, '/')
            .replace(/["'`]/g, '')
            .toLowerCase()
            .trim();
    }

    private scoreFileMatch(normalizedQuery: string, filePath: string): number {
        const relativePath = this.getRelativePath(filePath).toLowerCase();
        const baseName = path.basename(relativePath);
        const stem = baseName.replace(/\.[^.]+$/, '');

        if (normalizedQuery === relativePath) return 120;
        if (normalizedQuery.includes(relativePath)) return 110;
        if (normalizedQuery.endsWith(`/${relativePath}`)) return 105;
        if (normalizedQuery === baseName) return 100;
        if (normalizedQuery.includes(baseName)) return 90;
        if (stem.length >= 4 && normalizedQuery === stem) return 80;
        if (stem.length >= 4 && normalizedQuery.includes(stem)) return 70;

        const compactRelative = relativePath.replace(/\.[^.]+$/, '');
        if (normalizedQuery === compactRelative || normalizedQuery.includes(compactRelative)) return 75;

        return 0;
    }

    private resolveWasm(wasmName: string): string {
        const paths = [
            path.join(__dirname, wasmName),
            path.join(__dirname, '..', wasmName),
            path.join(__dirname, '..', '..', 'src', wasmName),
            path.join(__dirname, '..', '..', 'node_modules', 'web-tree-sitter', wasmName),
            path.join(process.cwd(), 'dist', wasmName),
            path.join(process.cwd(), 'src', wasmName),
            path.join(process.cwd(), wasmName),
            path.join(process.cwd(), 'node_modules', 'web-tree-sitter', wasmName)
        ];

        for (const candidate of paths) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return wasmName;
    }
}
