const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const outputFile = path.join(__dirname, 'claude_export.txt');

let outputContent = "# AI MEMORY OS - SOURCE CODE EXPORT\n\n";
outputContent += "This file contains the core logic of AI Memory OS for review.\n\n";

function readFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            readFiles(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            const relativePath = path.relative(__dirname, fullPath);
            const content = fs.readFileSync(fullPath, 'utf8');
            outputContent += `\n\n======================================================\n`;
            outputContent += `FILE: ${relativePath.replace(/\\/g, '/')}\n`;
            outputContent += `======================================================\n\n`;
            outputContent += content;
        }
    }
}

readFiles(srcDir);
fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(`Successfully exported all AI Memory OS code to ${outputFile}`);
