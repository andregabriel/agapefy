import fs from 'fs';
import path from 'path';

const root = process.cwd();
const appDir = path.join(root, 'src', 'app');
const outputPath = path.join(root, 'docs', 'ROUTES_INDEX.md');

function listFiles(dir, targetName, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(fullPath, targetName));
    } else if (entry.isFile() && entry.name === targetName) {
      results.push(fullPath);
    }
  }
  return results;
}

function isRouteGroup(segment) {
  return segment.startsWith('(') && segment.endsWith(')');
}

function toRoute(filePath, { isApi }) {
  const rel = path.relative(appDir, filePath);
  const parts = rel.split(path.sep);
  if (isApi && parts[0] !== 'api') return null;
  const parentParts = parts.slice(0, -1).filter((seg) => !isRouteGroup(seg));
  if (isApi) {
    if (parentParts.length === 1 && parentParts[0] === 'api') return '/api';
    return '/' + parentParts.join('/');
  }
  const route = parentParts.length ? '/' + parentParts.join('/') : '/';
  return route;
}

function uniqSorted(values) {
  return Array.from(new Set(values)).sort();
}

const pageFiles = listFiles(appDir, 'page.tsx').filter(
  (file) => !file.includes(`${path.sep}api${path.sep}`)
);
const apiFiles = listFiles(path.join(appDir, 'api'), 'route.ts');

const pages = uniqSorted(pageFiles.map((file) => toRoute(file, { isApi: false })).filter(Boolean));
const apis = uniqSorted(apiFiles.map((file) => toRoute(file, { isApi: true })).filter(Boolean));

const lines = [
  '# Routes Index',
  '',
  'Objetivo: mapa rapido das rotas do App Router. Derivado da estrutura de `src/app`.',
  '- Segmentos dinamicos em `[]`',
  '- Rotas de API em `src/app/api/*/route.ts`',
  '- Gerado por `node scripts/generate-routes-index.mjs`',
  '',
  '## Pages (`src/app/*/page.tsx`)',
  ...pages.map((route) => `- \`${route}\``),
  '',
  '## API routes (`src/app/api/*/route.ts`)',
  ...apis.map((route) => `- \`${route}\``),
  '',
];

fs.writeFileSync(outputPath, lines.join('\n'));
console.log(`Routes index written to ${path.relative(root, outputPath)}`);
