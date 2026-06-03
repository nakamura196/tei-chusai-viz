// parallel.js — 対訳ビュー（4列）。
// 年譜原文｜年譜現代語訳｜『渋江抽斎』原文｜『渋江抽斎』現代語訳。
// 現代語訳は AI 下書き（要校閲）。本文対応は TEI の anchor/@corresp に基づく。

export function renderParallel(container, model) {
  container.innerHTML = '';
  const pairs = model.parallels;
  const tr = model.translations || {};
  if (!pairs || !pairs.length) { container.textContent = '対応箇所が見つかりませんでした。'; return; }

  const s = model.parallelStats || { total: pairs.length, withNovel: pairs.length, chronOnly: 0 };
  const intro = document.createElement('p');
  intro.className = 'legend';
  intro.innerHTML =
    `年譜と森鷗外『渋江抽斎』の対応 <b>${s.total}</b> 件`
    + (s.chronOnly ? `（うち ${s.chronOnly} 件は青空側アンカー不足のため年譜のみ表示）` : '')
    + `。<span class="ai-badge">現代語訳=AI下書き・要校閲</span>`;
  container.appendChild(intro);

  const table = document.createElement('div');
  table.className = 'parallel';
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', '年譜と渋江抽斎の対訳');

  const cols = ['『抽斎年譜』', '年譜・現代語訳', '森鷗外『渋江抽斎』', '渋江抽斎・現代語訳'];
  const header = document.createElement('div');
  header.className = 'parallel-row parallel-head';
  header.setAttribute('role', 'row');
  header.innerHTML = cols.map((c, i) =>
    `<div class="cell" role="columnheader">${c}${i % 2 ? ' <span class="ai-tag">AI</span>' : ''}</div>`).join('');
  table.appendChild(header);

  const muted = (s) => `<span class="muted">${s}</span>`;
  for (const p of pairs) {
    const t = tr[p.key] || {};
    const multi = p.novelCount > 1
      ? `<span class="note-asterisk">（現代語訳は冒頭区間のみ。原文は ${p.novelCount} 区間を〔…〕で連結）</span>` : '';
    const novelModern = p.chronOnly ? muted('—') : ((t.novel || muted('（未訳）')) + multi);

    const row = document.createElement('div');
    row.className = 'parallel-row' + (p.chronOnly ? ' chron-only' : '');
    row.setAttribute('role', 'row');
    row.setAttribute('aria-label', `対応箇所 ${p.key}`);
    row.innerHTML =
      `<div class="cell chron" role="cell">${p.chron || muted('（抽出なし）')}</div>`
      + `<div class="cell modern" role="cell">${t.chron || muted('（未訳）')}</div>`
      + `<div class="cell novel" role="cell">${p.novel || muted('—')}</div>`
      + `<div class="cell modern" role="cell">${novelModern}</div>`;
    const tag = document.createElement('div');
    tag.className = 'cn-key';
    tag.textContent = p.key;
    row.appendChild(tag);
    table.appendChild(row);
  }
  container.appendChild(table);
}
