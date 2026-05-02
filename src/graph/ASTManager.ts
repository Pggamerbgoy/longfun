import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const Parser = require('web-tree-sitter');

export class ASTManager {
    private parser: any = null;
    private dependencyGraph: Map<string, string[]> = new Map();
    private tsLanguage: any = null;
    private jsLanguage: any = null;
    private pythonLanguage: any = null;

    constructor() {
        // Initialization handled in init()
    }

    async init() {
        await Parser.init();
        this.parser = new Parser();
        
        // Load WASM binaries (assuming they are next to the script or in src)
        try {
            // Try __dirname (when running from out/test_ast.js, __dirname is out/graph)
            // Or try current working directory (when running from root)
            const resolveWasm = (wasmName: string) => {
                const paths = [
                    path.join(__dirname, wasmName),
                    path.join(__dirname, '..', wasmName),
                    path.join(__dirname, '..', '..', 'src', wasmName),
                    path.join(process.cwd(), 'src', wasmName),
                    path.join(process.cwd(), wasmName)
                ];
                for (const p of paths) {
                    if (fs.existsSync(p)) return p;
                }
                return wasmName; // Fallback
            };

            this.tsLanguage = await Parser.Language.load(resolveWasm('tree-sitter-typescript.wasm'));
            this.jsLanguage = await Parser.Language.load(resolveWasm('tree-sitter-javascript.wasm'));
            this.pythonLanguage = await Parser.Language.load(resolveWasm('tree-sitter-python.wasm'));
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
        if (!this.parser) {
            console.warn('Parser not initialized, calling init()...');
            await this.init();
        }

        try {
            const ext = path.extname(filePath);
            this.setLanguage(ext);
            
            const tree = this.parser!.parse(content);
            const imports = this.extractImports(tree.rootNode, ext);
            
            this.dependencyGraph.set(filePath, imports);
            console.log(`Parsed ${path.basename(filePath)}. Found ${imports.length} imports.`);
        } catch (error) {
            console.error(`Error parsing file ${filePath}:`, error);
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
        const affectedFiles: string[] = [];
        const baseFileName = path.parse(filePath).name;

        for (const [dependentFile, imports] of this.dependencyGraph.entries()) {
            if (dependentFile === filePath) continue;

            const isAffected = imports.some(imp => 
                imp.includes(baseFileName) || imp.includes(path.basename(filePath))
            );

            if (isAffected) {
                affectedFiles.push(dependentFile);
            }
        }

        return [filePath, ...affectedFiles];
    }

    generateMermaidGraph(): string {
        let mermaid = 'graph TD\n';
        const projectRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

        for (const [file, imports] of this.dependencyGraph.entries()) {
            const fileName = path.relative(projectRoot, file).replace(/\\/g, '/');
            const fileId = fileName.replace(/[^a-zA-Z0-9]/g, '_');
            
            mermaid += `  ${fileId}["${fileName}"]\n`;
            
            for (const imp of imports) {
                const targetFile = Array.from(this.dependencyGraph.keys()).find(f => f.includes(imp));
                if (targetFile) {
                    const targetName = path.relative(projectRoot, targetFile).replace(/\\/g, '/');
                    const targetId = targetName.replace(/[^a-zA-Z0-9]/g, '_');
                    mermaid += `  ${fileId} --> ${targetId}\n`;
                }
            }
        }
        return mermaid;
    }
}
