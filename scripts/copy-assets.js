const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

fs.mkdirSync(dist, { recursive: true });

const assets = [
  [path.join(root, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'), 'tree-sitter.wasm'],
  [path.join(root, 'src', 'tree-sitter-javascript.wasm'), 'tree-sitter-javascript.wasm'],
  [path.join(root, 'src', 'tree-sitter-python.wasm'), 'tree-sitter-python.wasm'],
  [path.join(root, 'src', 'tree-sitter-typescript.wasm'), 'tree-sitter-typescript.wasm']
];

for (const [source, fileName] of assets) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing asset: ${source}`);
  }
  fs.copyFileSync(source, path.join(dist, fileName));
}

console.log(`Copied ${assets.length} AI Memory runtime asset(s).`);
