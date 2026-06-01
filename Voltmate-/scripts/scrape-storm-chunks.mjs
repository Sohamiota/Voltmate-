import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'https://www.eulermotors.com';
const page = '/en/euler-storm-t1500';

const res = await fetch(BASE + page);
const html = await res.text();
const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"'\\s]+\.js/g)].map(m => BASE + m[0]);
const found = new Set();

for (const url of chunks) {
  const js = await (await fetch(url)).text();
  // any path-like string with image extension
  for (const m of js.matchAll(/[A-Za-z0-9_./-]+\.(?:webp|png|jpg|jpeg)/g)) {
    const s = m[0];
    if (s.includes('images') || s.includes('hero') || s.includes('storm') || s.includes('hiload') || s.includes('turbo')) {
      found.add(s.startsWith('/') ? s : s.includes('/') ? s : null);
    }
  }
  for (const m of js.matchAll(/\/(?:images|hero|public)[^"'\\]+\.(?:webp|png|jpg|jpeg)/gi)) {
    found.add(m[0]);
  }
}

console.log([...found].filter(Boolean).sort().join('\n'));
