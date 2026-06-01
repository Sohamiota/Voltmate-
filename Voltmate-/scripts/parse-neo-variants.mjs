import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const h = fs.readFileSync(path.join(ROOT, 'tmp-neo-hirange.html'), 'utf8');

// decode next/image urls
for (const m of h.matchAll(/%2Fproduct%2F([^&"]+)/g)) {
  console.log(decodeURIComponent('%2F' + m[1].replace(/%2F/g, '/')));
}

// find MAXX PLUS labels
for (const m of h.matchAll(/>(HiRANGE[^<]{0,40}|HiCITY[^<]{0,40}|MAXX[^<]{0,20}|PLUS[^<]{0,20})</gi)) {
  console.log('label:', m[1]);
}
