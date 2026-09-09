
import fs from 'fs';
import path from 'path';

// List of products I successfully generated images for
const generatedCodes = [
    'FR-02', 'FR-03', 'FR-04',
    'FF-02', 'FF-03', 'FF-04',
    'A-02', 'A-03', 'A-04',
    'PF-08', 'PF-10', 'PF-13', 'PF-18', 'PF-20', 'PF-22',
    'PF-25', 'PF-32A', 'PF-32B', 'PF-50'
];

const productsFilePath = path.join(process.cwd(), 'src/lib/products.ts');
let content = fs.readFileSync(productsFilePath, 'utf8');

generatedCodes.forEach(code => {
    // Regex to find the object with this code and replace its imageUrl
    // This is tricky with regex. A simpler way is to replace based on known structure or specific string if unique.
    // imageUrl: '/catalogos/produtoAcougue/fr-02.png', -> imageUrl: '/generated_catalog/FR-02.png',

    // Safety check: specific replacements based on the original paths found in products.ts
    // I don't know the exact original paths for all from memory, but I can match the line containing the code and update the imageUrl line following it?
    // Or simpler: We know the standard pattern of the file.

    // Strategy: Read the file line by line. If we find `code: 'CODE'`, set a flag. When we find `imageUrl: ...`, replace it if flag is set.
});

const lines = content.split('\n');
let currentCode = null;

const newLines = lines.map(line => {
    const codeMatch = line.match(/code:\s*'([^']+)'/);
    if (codeMatch) {
        currentCode = codeMatch[1];
    }

    if (currentCode && generatedCodes.includes(currentCode) && line.trim().startsWith('imageUrl:')) {
        return `    imageUrl: '/generated_catalog/${currentCode}.png',`;
    }

    return line;
});

fs.writeFileSync(productsFilePath, newLines.join('\n'));
console.log('Updated products.ts');
