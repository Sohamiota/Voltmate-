const BASE = 'https://www.eulermotors.com';
const pages = ['/en/euler-hiload-ev', '/en/euler-storm-t1500', '/en/euler-turbo-ev', '/en/euler-storm-ev-longrange-200'];

for (const page of pages) {
  const html = await (await fetch(BASE + page)).text();
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"'\\s]+\.js/g)].map(m => BASE + m[0]);
  console.log('\n===', page, '===');
  for (const url of chunks) {
    const js = await (await fetch(url)).text();
    if (!/images\/(products|home)/.test(js)) continue;
    const imgs = [...js.matchAll(/\/images\/(?:products|home)\/[^"'\\]+\.(?:webp|png|jpg|jpeg)/g)].map(m => m[0]);
    if (imgs.length) console.log(url.split('/').pop(), [...new Set(imgs)].join(', '));
  }
}
