const BASE = 'https://www.eulermotors.com';
const res = await fetch(BASE + '/en');
const html = await res.text();
const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"'\\s]+\.js/g)].map(m => BASE + m[0]);

for (const url of chunks) {
  const js = await (await fetch(url)).text();
  if (!js.includes('variant1.png') && !js.includes('variant2.png')) continue;
  console.log('FILE', url.split('/').pop());
  for (const v of ['variant1.png', 'variant2.png']) {
    const idx = js.indexOf(v);
    console.log(js.slice(Math.max(0, idx - 250), idx + 100));
    console.log('---');
  }
}
