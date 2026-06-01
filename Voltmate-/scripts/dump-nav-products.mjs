const BASE = 'https://www.eulermotors.com';
const js = await (await fetch(BASE + '/_next/static/chunks/app/layout-4bea33e8af7624bb.js')).text();
const idx = js.indexOf('Turbo EV 1000');
console.log(js.slice(idx, idx + 1200));
