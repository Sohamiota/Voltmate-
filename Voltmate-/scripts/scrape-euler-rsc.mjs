import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const pages = [
  'https://www.eulermotors.com/en/euler-hiload-ev',
  'https://www.eulermotors.com/en/euler-storm-t1500',
  'https://www.eulermotors.com/en/euler-turbo-ev',
  'https://www.eulermotors.com/en/euler-storm-ev-longrange-200',
];

const paths = new Set();

for (const url of pages) {
  const res = await fetch(url);
  const text = await res.text();
  const slug = url.split('/').pop();
  fs.writeFileSync(path.join(ROOT, `tmp-${slug}.html`), text);

  for (const m of text.matchAll(/(?:\/images\/|\/hero\/)[A-Za-z0-9_./-]+\.(?:webp|png|jpg|jpeg)/gi)) {
    paths.add(m[0]);
  }
  // RSC flight data often embeds paths
  for (const m of text.matchAll(/images\\u002F[^"\\]+\.(?:webp|png|jpg|jpeg)/gi)) {
    paths.add('/' + m[0].replace(/\\u002F/g, '/'));
  }
}

console.log([...paths].sort().join('\n'));
