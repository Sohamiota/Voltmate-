import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = 'https://www.eulermotors.com';

const pages = [
  '/en/euler-hiload-ev',
  '/en/euler-storm-t1500',
  '/en/euler-turbo-ev',
  '/en/euler-storm-ev-longrange-200',
  '/en',
];

const chunkUrls = new Set();
const imagePaths = new Set();

for (const page of pages) {
  const res = await fetch(BASE + page);
  const html = await res.text();
  for (const m of html.matchAll(/\/_next\/static\/chunks\/[^"'\\s]+\.js/g)) {
    chunkUrls.add(BASE + m[0]);
  }
  for (const m of html.matchAll(/\/(?:images|hero)[^"'\\s]+\.(?:webp|png|jpg|jpeg)/gi)) {
    imagePaths.add(m[0]);
  }
}

console.log(`Fetching ${chunkUrls.size} chunks...`);
for (const chunkUrl of chunkUrls) {
  try {
    const cr = await fetch(chunkUrl);
    const js = await cr.text();
    for (const im of js.matchAll(/["'`](\/images\/[^"'`\\]+\.(?:webp|png|jpg|jpeg))["'`]/gi)) {
      imagePaths.add(im[1]);
    }
    for (const im of js.matchAll(/["'`](images\/[^"'`\\]+\.(?:webp|png|jpg|jpeg))["'`]/gi)) {
      imagePaths.add('/' + im[1]);
    }
    for (const im of js.matchAll(/["'`](\/hero\/[^"'`\\]+\.(?:webp|png|jpg|jpeg))["'`]/gi)) {
      imagePaths.add(im[1]);
    }
  } catch (e) {
    console.error('chunk fail', chunkUrl);
  }
}

const sorted = [...imagePaths].sort();
fs.writeFileSync(path.join(ROOT, 'tmp-euler-image-paths.txt'), sorted.join('\n'));
console.log(sorted.join('\n'));
