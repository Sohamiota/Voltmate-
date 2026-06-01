import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.startsWith('tmp-') && f.endsWith('.html'));
const urls = new Set();

for (const f of htmlFiles) {
  const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // _next/image?url=...
  for (const m of h.matchAll(/\/_next\/image\?url=([^"'&]+)/g)) {
    urls.add(decodeURIComponent(m[1]));
  }
  // direct paths
  for (const m of h.matchAll(/\/(?:images|product|bgImages|vehicles)\/[^\s"'<>]+\.(?:webp|png|jpg|jpeg)/gi)) {
    urls.add(m[0]);
  }
}

console.log([...urls].sort().join('\n'));
