// app.js — 各ビュー専用ページ用のエントリ。
// ページ側で window.CHUSAI = { view:'network'|'timeline'|'parallel', base:'../' } を設定してから読み込む。
// data の取得パスのみ base を前置する（ESモジュールの相対 import は app.js 基準なので不変）。
import { loadXML, buildModel } from './tei.js';
import { renderNetwork } from './network.js';
import { renderTimeline } from './timeline.js';
import { renderParallel } from './parallel.js';
import { insightsFor } from './insights.js';

const RENDER = { network: renderNetwork, timeline: renderTimeline, parallel: renderParallel };
const CFG = window.CHUSAI || {};
const base = CFG.base || '';
const view = RENDER[CFG.view] ? CFG.view : 'network';

const statusEl = () => document.getElementById('status');
let model = null;

function draw() {
  const panel = document.getElementById('view');
  panel.innerHTML = '';
  RENDER[view](panel, model);
  const ins = insightsFor(view, model);
  if (ins) panel.insertAdjacentHTML('afterbegin', ins);
}

async function main() {
  try {
    statusEl().textContent = 'TEI/XML を読み込み中…';
    const [chron, aozora, translations] = await Promise.all([
      loadXML(base + 'data/tei_chuusainenpu.xml'),
      loadXML(base + 'data/shibuechusai_aozora.xml'),
      fetch(base + 'data/translations.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    model = buildModel(chron, aozora);
    model.translations = translations;
    statusEl().innerHTML =
      `人物 <b>${model.nodes.length}</b> 名・対応箇所 <b>${model.parallelStats.total}</b> 件を抽出しました。`;
    draw();
  } catch (e) {
    statusEl().innerHTML = `<span class="error">⚠ 読み込みエラー: ${e.message}</span>`;
    console.error(e);
  }
}

// 画面「幅」変化時のみ再描画（モバイルのアドレスバー伸縮=高さ変化では再描画しない）
let resizeTimer, lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth || !model) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(draw, 250);
});

main();
