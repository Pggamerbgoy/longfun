"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTManager = void 0;
// import * as vscode from 'vscode';
var path = require("path");
var fs = require("fs");
var Parser = require('web-tree-sitter');
var ASTManager = /** @class */ (function () {
    function ASTManager(workspaceRoot) {
        if (workspaceRoot === void 0) { workspaceRoot = process.cwd(); }
        this.parser = null;
        this.dependencyGraph = new Map();
        this.tsLanguage = null;
        this.jsLanguage = null;
        this.pythonLanguage = null;
        this.workspaceRoot = path.resolve(workspaceRoot);
    }
    ASTManager.prototype.setWorkspaceRoot = function (workspaceRoot) {
        this.workspaceRoot = path.resolve(workspaceRoot);
    };
    ASTManager.prototype.getWorkspaceRoot = function () {
        return this.workspaceRoot;
    };
    ASTManager.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, err_1;
            var _this = this;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, Parser.init({
                            locateFile: function (scriptName) { return _this.resolveWasm(scriptName); }
                        })];
                    case 1:
                        _d.sent();
                        this.parser = new Parser();
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 6, , 7]);
                        _a = this;
                        return [4 /*yield*/, Parser.Language.load(this.resolveWasm('tree-sitter-typescript.wasm'))];
                    case 3:
                        _a.tsLanguage = _d.sent();
                        _b = this;
                        return [4 /*yield*/, Parser.Language.load(this.resolveWasm('tree-sitter-javascript.wasm'))];
                    case 4:
                        _b.jsLanguage = _d.sent();
                        _c = this;
                        return [4 /*yield*/, Parser.Language.load(this.resolveWasm('tree-sitter-python.wasm'))];
                    case 5:
                        _c.pythonLanguage = _d.sent();
                        console.log('ASTManager initialized with Web-Tree-sitter (WASM) for JS/TS/Python.');
                        return [3 /*break*/, 7];
                    case 6:
                        err_1 = _d.sent();
                        console.error('Failed to load WASM languages:', err_1);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    ASTManager.prototype.setLanguage = function (ext) {
        if (!this.parser)
            return;
        if (ext === '.ts' || ext === '.tsx') {
            if (this.tsLanguage)
                this.parser.setLanguage(this.tsLanguage);
        }
        else if (ext === '.js' || ext === '.jsx') {
            if (this.jsLanguage)
                this.parser.setLanguage(this.jsLanguage);
        }
        else if (ext === '.py') {
            if (this.pythonLanguage)
                this.parser.setLanguage(this.pythonLanguage);
        }
        else {
            if (this.tsLanguage)
                this.parser.setLanguage(this.tsLanguage);
        }
    };
    ASTManager.prototype.parseFile = function (filePath, content) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedFilePath, ext, tree, rawImports, imports;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalizedFilePath = path.resolve(filePath);
                        if (!!this.parser) return [3 /*break*/, 2];
                        console.warn('Parser not initialized, calling init()...');
                        return [4 /*yield*/, this.init()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        try {
                            ext = path.extname(normalizedFilePath);
                            this.setLanguage(ext);
                            tree = this.parser.parse(content);
                            rawImports = this.extractImports(tree.rootNode, ext);
                            console.log('RAW IMPORTS FROM EXTRACT:', rawImports);
                            imports = rawImports
                                .map(function (imp) { return _this.resolveImport(normalizedFilePath, imp); })
                                .filter(Boolean);
                            this.dependencyGraph.set(normalizedFilePath, __spreadArray([], new Set(imports), true));
                            console.log("Parsed ".concat(path.basename(normalizedFilePath), ". Found ").concat(imports.length, " imports."));
                        }
                        catch (error) {
                            console.error("Error parsing file ".concat(normalizedFilePath, ":"), error);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    ASTManager.prototype.extractImports = function (rootNode, ext) {
        var imports = [];
        var traverse = function (node) {
            var _a, _b, _c;
            // JS/TS import extraction
            if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
                if (node.type === 'import_statement') {
                    for (var _i = 0, _d = node.namedChildren; _i < _d.length; _i++) {
                        var child = _d[_i];
                        if (child.type === 'string' || child.type === 'string_fragment') {
                            var imp = child.text.replace(/['"]/g, '');
                            console.log('PUSHING IMPORT:', imp);
                            imports.push(imp);
                        }
                    }
                }
                else if (node.type === 'call_expression') {
                    if (((_a = node.child(0)) === null || _a === void 0 ? void 0 : _a.text) === 'require' && ((_b = node.child(1)) === null || _b === void 0 ? void 0 : _b.type) === 'arguments') {
                        var arg = (_c = node.child(1)) === null || _c === void 0 ? void 0 : _c.child(1);
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
                    for (var _e = 0, _f = node.namedChildren; _e < _f.length; _e++) {
                        var child = _f[_e];
                        if (child.type === 'dotted_name' || child.type === 'aliased_import' || child.type === 'relative_import') {
                            imports.push(child.text);
                        }
                    }
                }
            }
            for (var i = 0; i < node.childCount; i++) {
                var childNode = node.child(i);
                if (childNode)
                    traverse(childNode);
            }
        };
        traverse(rootNode);
        return __spreadArray([], new Set(imports), true);
    };
    ASTManager.prototype.analyzeImpact = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var targetFile, affectedFiles, queue, reverseGraph, _i, _a, _b, dependentFile, imports, _c, imports_1, imp, currentFile, dependents, _d, dependents_1, dependentFile;
            return __generator(this, function (_e) {
                targetFile = path.resolve(filePath);
                affectedFiles = new Set([targetFile]);
                queue = [targetFile];
                reverseGraph = new Map();
                for (_i = 0, _a = this.dependencyGraph.entries(); _i < _a.length; _i++) {
                    _b = _a[_i], dependentFile = _b[0], imports = _b[1];
                    for (_c = 0, imports_1 = imports; _c < imports_1.length; _c++) {
                        imp = imports_1[_c];
                        if (!reverseGraph.has(imp))
                            reverseGraph.set(imp, []);
                        reverseGraph.get(imp).push(dependentFile);
                    }
                }
                while (queue.length > 0) {
                    currentFile = queue.shift();
                    dependents = reverseGraph.get(currentFile) || [];
                    for (_d = 0, dependents_1 = dependents; _d < dependents_1.length; _d++) {
                        dependentFile = dependents_1[_d];
                        if (affectedFiles.has(dependentFile))
                            continue;
                        affectedFiles.add(dependentFile);
                        queue.push(dependentFile);
                    }
                }
                return [2 /*return*/, __spreadArray([], affectedFiles, true)];
            });
        });
    };
    ASTManager.prototype.getFileImpact = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var targetFile;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        targetFile = path.resolve(filePath);
                        _a = {
                            filePath: targetFile,
                            imports: this.getImportsForFile(targetFile),
                            directDependents: this.getDirectDependents(targetFile)
                        };
                        return [4 /*yield*/, this.analyzeImpact(targetFile)];
                    case 1: return [2 /*return*/, (_a.impactedFiles = _b.sent(),
                            _a)];
                }
            });
        });
    };
    ASTManager.prototype.getImportsForFile = function (filePath) {
        return __spreadArray([], (this.dependencyGraph.get(path.resolve(filePath)) || []), true);
    };
    ASTManager.prototype.getDirectDependents = function (filePath) {
        var targetFile = path.resolve(filePath);
        return __spreadArray([], this.dependencyGraph.entries(), true).filter(function (_a) {
            var imports = _a[1];
            return imports.includes(targetFile);
        })
            .map(function (_a) {
            var dependentFile = _a[0];
            return dependentFile;
        });
    };
    ASTManager.prototype.findFilesInQuery = function (query, limit) {
        var _this = this;
        if (limit === void 0) { limit = 5; }
        var normalizedQuery = this.normalizeForSearch(query);
        if (!normalizedQuery)
            return [];
        var scored = __spreadArray([], this.dependencyGraph.keys(), true).map(function (filePath) { return ({
            filePath: filePath,
            score: _this.scoreFileMatch(normalizedQuery, filePath)
        }); })
            .filter(function (item) { return item.score > 0; })
            .sort(function (a, b) {
            if (b.score !== a.score)
                return b.score - a.score;
            return path.relative(_this.workspaceRoot, a.filePath).length - path.relative(_this.workspaceRoot, b.filePath).length;
        });
        return scored.slice(0, limit).map(function (item) { return item.filePath; });
    };
    ASTManager.prototype.deleteFile = function (filePath) {
        var normalizedFilePath = path.resolve(filePath);
        this.dependencyGraph.delete(normalizedFilePath);
        for (var _i = 0, _a = this.dependencyGraph.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], dependentFile = _b[0], imports = _b[1];
            this.dependencyGraph.set(dependentFile, imports.filter(function (imp) { return imp !== normalizedFilePath; }));
        }
    };
    ASTManager.prototype.clear = function () {
        this.dependencyGraph.clear();
    };
    ASTManager.prototype.getFileCount = function () {
        return this.dependencyGraph.size;
    };
    ASTManager.prototype.getIndexedFiles = function () {
        return __spreadArray([], this.dependencyGraph.keys(), true);
    };
    ASTManager.prototype.isIndexedFile = function (filePath) {
        return this.dependencyGraph.has(path.resolve(filePath));
    };
    ASTManager.prototype.getRelativePath = function (filePath) {
        return path.relative(this.workspaceRoot, path.resolve(filePath)).replace(/\\/g, '/');
    };
    ASTManager.prototype.generateMermaidGraph = function () {
        var mermaid = 'graph TD\n';
        for (var _i = 0, _a = this.dependencyGraph.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], file = _b[0], imports = _b[1];
            var fileName = path.relative(this.workspaceRoot, file).replace(/\\/g, '/');
            var fileId = 'node_' + fileName.replace(/[^a-zA-Z0-9]/g, '_');
            mermaid += "  ".concat(fileId, "[\"").concat(fileName, "\"]\n");
            for (var _c = 0, imports_2 = imports; _c < imports_2.length; _c++) {
                var imp = imports_2[_c];
                if (this.dependencyGraph.has(imp)) {
                    var targetName = path.relative(this.workspaceRoot, imp).replace(/\\/g, '/');
                    var targetId = 'node_' + targetName.replace(/[^a-zA-Z0-9]/g, '_');
                    mermaid += "  ".concat(fileId, " --> ").concat(targetId, "\n");
                }
            }
        }
        return mermaid;
    };
    ASTManager.prototype.resolveImport = function (fromFile, importPath) {
        var basePath;
        if (path.isAbsolute(importPath)) {
            basePath = importPath;
        }
        else if (importPath.startsWith('./') || importPath.startsWith('../')) {
            basePath = path.resolve(path.dirname(fromFile), importPath);
        }
        else if (importPath.startsWith('.')) {
            var withoutLeadingDots = importPath.replace(/^\.+/, '').replace(/^[/\\]/, '');
            basePath = path.resolve(path.dirname(fromFile), withoutLeadingDots);
        }
        else {
            basePath = path.join(this.workspaceRoot, importPath.replace(/\./g, path.sep));
        }
        var candidates = [
            basePath,
            "".concat(basePath, ".ts"),
            "".concat(basePath, ".tsx"),
            "".concat(basePath, ".js"),
            "".concat(basePath, ".jsx"),
            "".concat(basePath, ".py"),
            path.join(basePath, 'index.ts'),
            path.join(basePath, 'index.tsx'),
            path.join(basePath, 'index.js'),
            path.join(basePath, 'index.jsx'),
            path.join(basePath, '__init__.py')
        ];
        for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
            var candidate = candidates_1[_i];
            if (fs.existsSync(candidate)) {
                return path.resolve(candidate);
            }
        }
        return path.resolve(basePath);
    };
    ASTManager.prototype.normalizeForSearch = function (value) {
        return value
            .replace(/\\/g, '/')
            .replace(/["'`]/g, '')
            .toLowerCase()
            .trim();
    };
    ASTManager.prototype.scoreFileMatch = function (normalizedQuery, filePath) {
        var relativePath = this.getRelativePath(filePath).toLowerCase();
        var baseName = path.basename(relativePath);
        var stem = baseName.replace(/\.[^.]+$/, '');
        if (normalizedQuery === relativePath)
            return 120;
        if (normalizedQuery.includes(relativePath))
            return 110;
        if (normalizedQuery.endsWith("/".concat(relativePath)))
            return 105;
        if (normalizedQuery === baseName)
            return 100;
        if (normalizedQuery.includes(baseName))
            return 90;
        if (stem.length >= 4 && normalizedQuery === stem)
            return 80;
        if (stem.length >= 4 && normalizedQuery.includes(stem))
            return 70;
        var compactRelative = relativePath.replace(/\.[^.]+$/, '');
        if (normalizedQuery === compactRelative || normalizedQuery.includes(compactRelative))
            return 75;
        return 0;
    };
    ASTManager.prototype.resolveWasm = function (wasmName) {
        var paths = [
            path.join(__dirname, wasmName),
            path.join(__dirname, '..', wasmName),
            path.join(__dirname, '..', '..', 'src', wasmName),
            path.join(__dirname, '..', '..', 'node_modules', 'web-tree-sitter', wasmName),
            path.join(process.cwd(), 'dist', wasmName),
            path.join(process.cwd(), 'src', wasmName),
            path.join(process.cwd(), wasmName),
            path.join(process.cwd(), 'node_modules', 'web-tree-sitter', wasmName)
        ];
        for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
            var candidate = paths_1[_i];
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return wasmName;
    };
    return ASTManager;
}());
exports.ASTManager = ASTManager;
