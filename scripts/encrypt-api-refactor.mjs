// scripts/encrypt-api-refactor.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiDir = path.resolve(__dirname, '../src/app/api');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const IMPORT_STATEMENT = `import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';`;

let updatedCount = 0;

walkDir(apiDir, (filePath) => {
  if (!filePath.endsWith('route.ts')) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // We only care if it uses NextResponse.json or req.json
  if (!content.includes('.json(')) return;

  // 1. Add import if not present, and if we're going to modify something
  let needsImport = false;

  // 2. Replace req.json() and request.json()
  // Pattern: await req.json() or await request.json()
  if (/await\s+(req|request)\.json\(\)/.test(content)) {
    content = content.replace(/await\s+(req|request)\.json\(\)/g, 'await secureJsonRequest($1)');
    needsImport = true;
  }

  // 3. Replace NextResponse.json(...)
  // Pattern: NextResponse.json(...)
  if (/NextResponse\.json\s*\(/.test(content)) {
    content = content.replace(/NextResponse\.json\s*\(/g, 'await secureJsonResponse(');
    
    // Fix implicit returns in arrow functions if they aren't async.
    content = content.replace(/=\s*\(\)\s*=>\s*await secureJsonResponse/g, '= async () => await secureJsonResponse');
    content = content.replace(/=\s*\(req(uest)?(:\s*NextRequest)?\)\s*=>\s*await secureJsonResponse/g, '= async (req$2) => await secureJsonResponse');

    needsImport = true;
  }

  // Inject import after the last import statement or at the top
  if (needsImport && !content.includes('@/lib/payload-crypto')) {
    const importRegex = /^import\s+.*?;/gm;
    let lastIndex = 0;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex > 0) {
      content = content.slice(0, lastIndex) + '\n' + IMPORT_STATEMENT + content.slice(lastIndex);
    } else {
      content = IMPORT_STATEMENT + '\n' + content;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    updatedCount++;
    console.log(`Updated ${path.relative(apiDir, filePath)}`);
  }
});

console.log(`\nRefactoring complete. Updated ${updatedCount} files.`);
