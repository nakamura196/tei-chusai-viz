// app.js — エントリポイント。データを読み込み、タブで3ビューを切り替える。
import { loadXML, buildModel } from './tei.js';
import { renderNetwork } from './network.js';
import { renderTimeline } from './timeline.js';
import { renderParallel } from './parallel.js';
import { insightsFor } from './insights.js';

const VIEWS = {
  network: { label: '人物ネットワーク', render: renderNetwork },
  timeline: { label: '人物登場タイムライン', render: renderTimeline },
  parallel: { label: '年譜⇔渋江抽斎 対訳', render: renderParallel },
};

let model = null;
let current = null;
const rendered = new Set(); // 描画済みビュー（再計算を避ける）

const statusEl = () => document.getElementById('status');
const viewEl = () => document.getElementById('view');

function showError(e) {
  statusEl().innerHTML = `<span class="error">⚠ 読み込みエラー: ${e.message}</span>`;
  console.error(e);
}

function buildTabs() {
  const nav = document.getElementById('tabs');
  nav.setAttribute('role', 'tablist');
  for (const [key, v] of Object.entries(VIEWS)) {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.dataset.key = key;
    b.id = `tab-${key}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', `panel-${key}`);
    b.setAttribute('aria-selected', 'false');
    b.tabIndex = -1;
    b.addEventListener('click', () => select(key));
    nav.appendChild(b);
  }
  // 矢印キーでタブ移動（WAI-ARIA Tabs パターン）
  nav.addEventListener('keydown', (e) => {
    const keys = Object.keys(VIEWS);
    const i = keys.indexOf(current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const ni = (i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length;
      select(keys[ni]);
      document.getElementById(`tab-${keys[ni]}`).focus();
      e.preventDefault();
    }
  });
}

function select(key) {
  if (!model) return;
  current = key;
  for (const b of document.querySelectorAll('#tabs button')) {
    const on = b.dataset.key === key;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  }
  for (const panel of document.querySelectorAll('.panel')) panel.hidden = panel.id !== `panel-${key}`;

  const panel = document.getElementById(`panel-${key}`);
  if (!rendered.has(key)) {
    VIEWS[key].render(panel, model);
    const ins = insightsFor(key, model);
    if (ins) panel.insertAdjacentHTML('afterbegin', ins); // インサイトを先頭に
    rendered.add(key);
  }
}

async function main() {
  buildTabs();
  for (const key of Object.keys(VIEWS)) {
    const panel = document.createElement('div');
    panel.id = `panel-${key}`;
    panel.className = 'panel';
    panel.hidden = true;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${key}`);
    panel.tabIndex = 0;
    viewEl().appendChild(panel);
  }
  try {
    statusEl().textContent = 'TEI/XML を読み込み中…';
    const [chron, aozora, translations] = await Promise.all([
      loadXML('data/tei_chuusainenpu.xml'),
      loadXML('data/shibuechusai_aozora.xml'),
      fetch('data/translations.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    model = buildModel(chron, aozora);
    model.translations = translations;
    statusEl().innerHTML =
      `人物 <b>${model.nodes.length}</b> 名・対応箇所 <b>${model.parallelStats.total}</b> 件を抽出しました。`;
    select('network');
  } catch (e) {
    showError(e);
  }
}

// 画面「幅」変化時のみ現在ビューを再描画（モバイルのアドレスバー伸縮=高さ変化では再描画しない）
let resizeTimer, lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (model && current) { rendered.delete(current); select(current); }
  }, 250);
});

main();
