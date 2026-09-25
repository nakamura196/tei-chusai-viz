#!/usr/bin/env node
/**
 * 本番 (chusai.ldas.jp) と旧 URL の転送を、実際に HTTP で叩いて確かめる。
 * 配布後・独自ドメインの設定後に手元で実行する: npm run test:live
 *
 * 見ること:
 *   1. 新ホストの 4 ページが 200 で、canonical がそれぞれ自分を指す
 *   2. 各ページが読む相対の資産 (css, js, favicon 等)、OGP 画像、data/ の XML・JSON、
 *      manifest・robots.txt・sitemap.xml が 200
 *   3. 存在しないパスが 404、http は https へ転送
 *   4. 旧 github.io/tei-chusai-viz/<path>?<query> が同じパス・クエリのまま新ホストへ 301
 */
const NEW = 'https://chusai.ldas.jp';
const OLD = 'https://nakamura196.github.io/tei-chusai-viz';
const PAGES = ['', 'network/', 'timeline/', 'parallel/'];

const errors = [];
let passed = 0;
const ok = (cond, msg) => (cond ? passed++ : errors.push(msg));
const get = (url, opts = {}) => fetch(url, { redirect: 'manual', ...opts });

// 1, 2
const assets = new Set(['site.webmanifest', 'robots.txt', 'sitemap.xml', 'js/tei.js', 'js/network.js',
  'js/timeline.js', 'js/parallel.js', 'js/insights.js', 'data/tei_chuusainenpu.xml',
  'data/shibuechusai_aozora.xml', 'data/translations.json']);
for (const page of PAGES) {
  const r = await get(`${NEW}/${page}`);
  ok(r.status === 200, `${NEW}/${page} → ${r.status} (200 のはず)`);
  const html = await r.text();
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  ok(canonical === `${NEW}/${page}`, `/${page} の canonical が ${canonical}`);
  for (const m of html.matchAll(/\s(?:href|src)="([^"#:]+)"/g)) {
    assets.add(new URL(m[1], `${NEW}/${page}`).pathname.slice(1));
  }
  for (const m of html.matchAll(/(?:property="og:image"|name="twitter:image")\s+content="([^"]+)"/g)) {
    assets.add(new URL(m[1]).pathname.slice(1));
  }
}
for (const path of assets) {
  if (path === '' || path.endsWith('/')) continue; // ページは上で見た
  const r = await get(`${NEW}/${path}`);
  ok(r.status === 200, `${NEW}/${path} → ${r.status}`);
}

// 3
{
  const r = await get(NEW + '/no-such-page/');
  ok(r.status === 404, `存在しないページが ${r.status} (404 のはず)`);
  const h = await get('http://chusai.ldas.jp/network/?q=1');
  const loc = h.headers.get('location');
  ok(h.status === 301 && loc === `${NEW}/network/?q=1`, `http → ${h.status} ${loc} (301 ${NEW}/network/?q=1 のはず)`);
}

// 4
for (const path of ['/', '/network/', '/timeline/?q=1', '/parallel/', '/assets/og.png', '/data/tei_chuusainenpu.xml']) {
  const r = await get(OLD + path);
  const loc = r.headers.get('location');
  ok(r.status === 301 && loc === NEW + path, `${OLD}${path} → ${r.status} ${loc} (301 ${NEW + path} のはず)`);
}

if (errors.length) {
  console.error(`NG: ${errors.length} 件 (OK ${passed} 件)`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`OK: ${passed} 件`);
