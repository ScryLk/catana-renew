import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'shared/font_registry.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'shared/contracts/generative.json'), 'utf8'));
const css = '@import url("https://fonts.googleapis.com/css2?' + registry.fonts.map(f => 'family=' + f.family.replaceAll(' ', '+') + (f.italics ? ':ital,wght@0,' + f.weights.join(';0,') + ';1,400' : f.weights.length > 1 ? ':wght@' + f.weights.join(';') : '')).join('&') + '&display=swap");\n';
const outputs = {
 'frontend/src/generated/fontRegistry.generated.ts': '// Generated from shared/font_registry.json. Do not edit.\nexport const FONT_REGISTRY = ' + JSON.stringify(registry, null, 2) + ' as const;\nexport const ALL_VERIFIED_FONTS = FONT_REGISTRY.fonts.map(font => font.family);\n',
 'frontend/src/generated/fonts.generated.css': css,
 'frontend/src/generated/generativeContract.generated.ts': '// Generated from shared/contracts/generative.json. Do not edit.\nexport const GENERATIVE_CONTRACT = ' + JSON.stringify(contract, null, 2) + ' as const;\n',
};
let drift = false;
for (const [file, contents] of Object.entries(outputs)) {
 const target = path.join(root, file);
 if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents) { console.error('Generated contract drift: ' + file); drift = true; }
 } else { fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, contents); }
}
if (drift) process.exit(1);
