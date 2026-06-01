#!/usr/bin/env node
/**
 * Download Euler / Neo vehicle images from official sites into public/vehicles/.
 * Run: node scripts/download-euler-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'vehicles');

/** Direct asset URLs (from eulermotors.com & neo.eulermotors.com) */
const ASSETS = [
  // Commercial — eulermotors.com
  {
    url: 'https://www.eulermotors.com/images/products/hiload/HighloadDV.png',
    file: 'hiload-delivery-van.png',
  },
  {
    url: 'https://www.eulermotors.com/images/products/hiload/HighloadPV.png',
    file: 'hiload-pickup-van.png',
  },
  {
    url: 'https://www.eulermotors.com/images/products/turbo/turbo_loader.jpg',
    file: 'turbo-ev.jpg',
  },
  {
    url: 'https://www.eulermotors.com/images/home/storm-ev_lr200.webp',
    file: 'storm-ev-lr200.webp',
  },
  {
    url: 'https://www.eulermotors.com/images/home/variant1.png',
    file: 'storm-t1500.png',
  },
  {
    url: 'https://www.eulermotors.com/images/home/variant2.png',
    file: 'turbo-ev-variant.png',
  },
  {
    url: 'https://www.eulermotors.com/images/home/variant3.png',
    file: 'hiload-ev.png',
  },
  // Passenger — neo.eulermotors.com product shots
  {
    url: 'https://neo.eulermotors.com/product/HiRange/HiRange.2143.webp',
    file: 'neo-hirange.webp',
  },
  {
    url: 'https://neo.eulermotors.com/product/HiRange/HiRange.2141.webp',
    file: 'neo-hirange-plus.webp',
  },
  {
    url: 'https://neo.eulermotors.com/product/HiRange/HiRange.2142.webp',
    file: 'neo-hirange-maxx.webp',
  },
  {
    url: 'https://neo.eulermotors.com/product/HiCity/HiCity.2159.webp',
    file: 'neo-hicity.webp',
  },
  {
    url: 'https://neo.eulermotors.com/product/HiCity/HiCity.2157.webp',
    file: 'neo-hicity-maxx.webp',
  },
  // Gallery / alternate angles (used when available)
  {
    url: 'https://neo.eulermotors.com/product/HiRange/HiRange.2144.webp',
    file: 'neo-hirange-alt1.webp',
  },
  {
    url: 'https://neo.eulermotors.com/product/HiRange/HiRange.2145.webp',
    file: 'neo-hirange-alt2.webp',
  },
  {
    url: 'https://neo.eulermotors.com/product/HiCity/HiCity.2154.webp',
    file: 'neo-hicity-alt1.webp',
  },
  {
    url: 'https://neo.eulermotors.com/product/HiCity/HiCity.2155.webp',
    file: 'neo-hicity-alt2.webp',
  },
  {
    url: 'https://neo.eulermotors.com/product/HiCity/HiCity.2165.webp',
    file: 'neo-hicity-alt3.webp',
  },
  // High-res hero shots from Neo CDN
  {
    url: 'https://assets.neobyeuler.com/medium_Hirange_2560_X1400_jpg_1_1_a7dbba02d5.webp',
    file: 'neo-hirange-hero.webp',
  },
  {
    url: 'https://assets.neobyeuler.com/medium_Hicity_2560_X1400_2_1_69d8238fe0.webp',
    file: 'neo-hicity-hero.webp',
  },
];

async function downloadOne({ url, file }) {
  const dest = path.join(OUT, file);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VoltWheels-EMS/1.0 (asset sync)' },
  });
  if (!res.ok) {
    return { file, ok: false, status: res.status };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { file, ok: true, bytes: buf.length };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  for (const asset of ASSETS) {
    try {
      results.push(await downloadOne(asset));
    } catch (e) {
      results.push({ file: asset.file, ok: false, error: String(e) });
    }
  }
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  console.log(`Downloaded ${ok.length}/${ASSETS.length}`);
  for (const r of ok) console.log(`  OK  ${r.file} (${r.bytes} bytes)`);
  for (const r of fail) console.log(`  FAIL ${r.file}`, r.status ?? r.error);
  if (fail.length) process.exitCode = 1;
}

main();
