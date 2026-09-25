/**
 * 公開 URL (https://chusai.ldas.jp) を決めている箇所を固定する。
 * ドメインを変えるときは、ここと該当ファイルを同時に直す。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SITE = 'https://chusai.ldas.jp';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// ページ (配信パス) → OGP 画像
const PAGES = {
  '': 'og.png',
  'network/': 'og-network.png',
  'timeline/': 'og-timeline.png',
  'parallel/': 'og-parallel.png',
};

test('CNAME はホスト名 1 行だけ (GitHub Pages の独自ドメイン)', () => {
  assert.equal(read('CNAME'), 'chusai.ldas.jp\n');
});

for (const [page, og] of Object.entries(PAGES)) {
  const html = read(`${page}index.html`);
  const attr = (re) => html.match(re)?.[1];

  test(`/${page}: canonical と og:url が新ホストの同じページを指す`, () => {
    assert.equal(attr(/<link rel="canonical" href="([^"]+)"/), `${SITE}/${page}`);
    assert.equal(attr(/property="og:url" content="([^"]+)"/), `${SITE}/${page}`);
  });

  test(`/${page}: og:image と twitter:image が新ホストの ${og} を指す`, () => {
    const imgs = [...html.matchAll(/(?:property="og:image"|name="twitter:image")\s+content="([^"]+)"/g)];
    assert.equal(imgs.length, 2);
    for (const m of imgs) assert.equal(m[1], `${SITE}/assets/${og}`);
  });

  test(`/${page}: サイト内の参照は相対パスだけ (/ 始まりはサブパス配信で壊れる)`, () => {
    const rootAbs = [...html.matchAll(/\s(?:href|src)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(rootAbs, []);
  });
}

test('トップの構造化データ (JSON-LD) の URL と @id が新ホスト', () => {
  const ld = JSON.parse(read('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const ids = JSON.stringify(ld).match(/"(?:@id|url|screenshot)":"https:\/\/[^"]+"/g);
  const own = ids.filter((s) => !s.includes('github.com') && !s.includes('dhlibrarianstudygroup'));
  assert.ok(own.length >= 5);
  for (const s of own) assert.ok(s.includes(`"${SITE}/`), s);
});

test('OGP 画像の元 SVG に焼き込む URL が新ホスト', () => {
  for (const [page, og] of Object.entries(PAGES)) {
    const svg = read(`assets/${og.replace('.png', '.svg')}`);
    assert.ok(svg.includes(`>chusai.ldas.jp${page ? '/' + page : ''}<`), og);
  }
});

test('robots.txt が新ホストの sitemap を示す', () => {
  assert.match(read('robots.txt'), new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml$`, 'm'));
});

test('sitemap.xml は新ホストの 4 ページ', () => {
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, Object.keys(PAGES).map((p) => `${SITE}/${p}`));
});

test('site.webmanifest の start_url / scope はマニフェストからの相対 (./)', () => {
  const mf = JSON.parse(read('site.webmanifest'));
  assert.equal(mf.start_url, './');
  assert.equal(mf.scope, './');
});
