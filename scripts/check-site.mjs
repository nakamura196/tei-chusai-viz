#!/usr/bin/env node
/**
 * 配信するファイルの中の参照が、すべて実在するファイルを指しているか確かめる。
 * ビルドは無く、リポジトリ直下がそのまま GitHub Pages で配られるので、直下を直接見る。
 *
 * 使い方: npm run test:site (npm test にも含まれる)
 *
 * 見ること:
 *   1. HTML の href / src / content のうちサイト内を指すもの (相対参照・サイトの絶対 URL) が
 *      ファイルに解決できる
 *   2. / で始まる参照が無い (旧 URL の /tei-chusai-viz/ 配下でもホスト直下でも同じに動くよう、相対で書く)
 *   3. 旧ホスト (github.io/tei-chusai-viz) を指す文字列が残っていない
 *   4. robots.txt の Sitemap と sitemap.xml の各 URL が実在するページを指す
 *   5. JS の相対 import と、app.js が base 付きで読む data/ のファイルが実在する
 *   6. サブページの window.CHUSAI.base がページの深さと合っている
 *   7. site.webmanifest の start_url / scope が相対で、アイコンが実在する
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, posix } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const siteUrl = 'https://chusai.ldas.jp';
const FORBIDDEN = ['nakamura196.github.io/tei-chusai-viz'];
// 配信はされるが、サイトの一部ではないもの (開発用)。
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'scripts', 'tests']);

const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

/** 配信パスがファイルに解決できるか。GitHub Pages と同じ規則。 */
function resolves(servedPath) {
  let p = decodeURIComponent(servedPath.split(/[?#]/)[0]);
  if (p === '' || p.endsWith('/')) p += 'index.html';
  const abs = join(ROOT, p);
  if (!abs.startsWith(ROOT)) return false;
  if (existsSync(abs) && statSync(abs).isFile()) return true;
  if (existsSync(abs + '.html')) return true;
  return existsSync(join(abs, 'index.html'));
}

const rel = (file) => relative(ROOT, file).split('\\').join('/');

/** file から見た相対参照 ref が指す配信パス (解決できなければ null)。 */
function target(ref, file) {
  const path = ref.split(/[?#]/)[0];
  const t = posix.normalize(posix.join(posix.dirname(rel(file)), path));
  if (t.startsWith('..')) return null;
  return t + (path.endsWith('/') && !t.endsWith('/') ? '/' : '');
}

const files = walk(ROOT);
let checkedRefs = 0;

function checkRef(ref, file) {
  const where = rel(file);
  if (!ref || ref.startsWith('#') || ref.startsWith('data:') || ref.startsWith('mailto:')) return;
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) {
    // 外部 URL。サイト自身の絶対 URL だけ確かめる (canonical, og:image など)。
    if (ref === siteUrl || ref.startsWith(siteUrl + '/')) {
      checkedRefs++;
      if (!resolves(ref.slice(siteUrl.length).replace(/^\//, ''))) {
        fail(`${where}: サイトの絶対 URL がファイルに解決できない: ${ref}`);
      }
    }
    return;
  }
  checkedRefs++;
  if (ref.startsWith('/')) {
    fail(`${where}: / で始まる参照 (相対で書く): ${ref}`);
    return;
  }
  const t = target(ref, file);
  if (t === null) fail(`${where}: サイトの外を指す相対参照: ${ref}`);
  else if (!resolves(t)) fail(`${where}: 相対参照の先のファイルが無い: ${ref}`);
}

for (const file of files) {
  if (!/\.(html|css|js|txt|xml|json|svg|webmanifest)$/.test(file)) continue;
  const where = rel(file);
  const text = readFileSync(file, 'utf8');
  for (const bad of FORBIDDEN) {
    if (text.includes(bad)) fail(`${where}: 旧ホストへの参照が残っている: ${bad}`);
  }
  if (file.endsWith('.html')) {
    for (const m of text.matchAll(/\s(href|src|content)="([^"]*)"/g)) {
      const v = m[2].replaceAll('&amp;', '&');
      // content 属性は meta の値。URL らしいものだけを対象にする。
      if (m[1] === 'content' && !(v.startsWith('/') || v.startsWith(siteUrl))) continue;
      checkRef(v, file);
    }
    // 6. サブページは data/ を base 付きで読む。深さと合っていなければ data が 404 になる。
    const base = text.match(/window\.CHUSAI\s*=\s*\{[^}]*base:\s*"([^"]*)"/)?.[1];
    if (base !== undefined) {
      const depth = rel(file).split('/').length - 1;
      if (base !== '../'.repeat(depth)) fail(`${where}: CHUSAI.base が "${base}" (深さ ${depth} なので "${'../'.repeat(depth)}" のはず)`);
    }
  }
  if (file.endsWith('.js') && !file.endsWith('.min.js')) {
    // 5. ES モジュールの相対 import
    for (const m of text.matchAll(/\bfrom\s+'(\.{1,2}\/[^']+)'/g)) checkRef(m[1], file);
  }
}

// 5. app.js が base + '...' で読むデータ。base はページ側で直下に合わせるので、直下からの相対として見る。
{
  const app = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  const data = [...app.matchAll(/base \+ '([^']+)'/g)].map((m) => m[1]);
  if (data.length === 0) fail('js/app.js: base + \'...\' のデータ読み込みが見つからない');
  for (const d of data) {
    checkedRefs++;
    if (!resolves(d)) fail(`js/app.js: 読み込むデータが無い: ${d}`);
  }
}

// 7. web app manifest
{
  const mf = JSON.parse(readFileSync(join(ROOT, 'site.webmanifest'), 'utf8'));
  for (const k of ['start_url', 'scope']) {
    if (typeof mf[k] !== 'string' || mf[k].startsWith('/') || /^[a-z]+:/i.test(mf[k])) {
      fail(`site.webmanifest: ${k} が相対でない: ${mf[k]}`);
    }
  }
  for (const icon of mf.icons ?? []) checkRef(icon.src, join(ROOT, 'site.webmanifest'));
}

if (!existsSync(join(ROOT, 'index.html'))) fail('index.html が無い');

const robotsPath = join(ROOT, 'robots.txt');
if (!existsSync(robotsPath)) fail('robots.txt が無い');
else if (!readFileSync(robotsPath, 'utf8').includes(`Sitemap: ${siteUrl}/sitemap.xml`)) {
  fail(`robots.txt に "Sitemap: ${siteUrl}/sitemap.xml" が無い`);
}
const sitemapPath = join(ROOT, 'sitemap.xml');
if (!existsSync(sitemapPath)) fail('sitemap.xml が無い');
else {
  const locs = [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) fail('sitemap.xml に URL が 1 件も無い');
  for (const loc of locs) {
    if (!loc.startsWith(siteUrl + '/')) fail(`sitemap.xml: 新ホストでない URL: ${loc}`);
    checkRef(loc, sitemapPath);
  }
}

if (errors.length) {
  console.error(`NG: ${errors.length} 件`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`OK: ${files.length} ファイル、サイト内参照 ${checkedRefs} 件 (siteUrl=${siteUrl})`);
