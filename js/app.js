// app.js — エントリポイント。データを読み込み、タブで3ビューを切り替える。
import { loadXML, buildModel } from './tei.js';
import { renderNetwork } from './network.js';
import { renderTimeline } from './timeline.js';
import { renderParallel } from './parallel.js';

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
  statusEl().innerHTML = `<span class="error">読み込みエラー: ${e.message}</span>`;
  console.error(e);
}

function buildTabs() {
  const nav = document.getElementById('tabs');
  for (const [key, v] of Object.entries(VIEWS)) {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.dataset.key = key;
    b.addEventListener('click', () => select(key));
    nav.appendChild(b);
  }
}

function select(key) {
  if (!model) return;
  current = key;
  for (const b of document.querySelectorAll('#tabs button'))
    b.classList.toggle('active', b.dataset.key === key);
  for (const panel of document.querySelectorAll('.panel')) panel.hidden = panel.id !== `panel-${key}`;

  const panel = document.getElementById(`panel-${key}`);
  if (!rendered.has(key)) {
    VIEWS[key].render(panel, model);
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
    viewEl().appendChild(panel);
  }
  try {
    statusEl().textContent = 'TEI/XML を読み込み中…';
    const [chron, aozora] = await Promise.all([
      loadXML('data/tei_chuusainenpu.xml'),
      loadXML('data/shibuechusai_aozora.xml'),
    ]);
    model = buildModel(chron, aozora);
    statusEl().innerHTML =
      `人物 <b>${model.nodes.length}</b> 名・対応箇所 <b>${model.parallels.length}</b> 件を抽出しました。`;
    select('network');
  } catch (e) {
    showError(e);
  }
}

// 画面幅変化で現在ビューを再描画（簡易レスポンシブ）
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (model && current) { rendered.delete(current); select(current); }
  }, 250);
});

main();
