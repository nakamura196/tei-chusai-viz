// parallel.js — 対訳ビュー。年譜の範囲（cnK_s〜cnK_e）と、
// 『渋江抽斎』本文の対応箇所（corresp=#cnK_s/_e）を左右で対照表示する。

export function renderParallel(container, model) {
  container.innerHTML = '';
  const pairs = model.parallels;
  if (!pairs.length) { container.textContent = '対応箇所が見つかりませんでした。'; return; }

  const intro = document.createElement('p');
  intro.className = 'legend';
  intro.textContent = `年譜と森鷗外『渋江抽斎』の対応箇所 ${pairs.length} 件。`
    + `左＝『抽斎年譜』、右＝『渋江抽斎』。TEI の anchor/@corresp で連結されています。`;
  container.appendChild(intro);

  const table = document.createElement('div');
  table.className = 'parallel';

  const header = document.createElement('div');
  header.className = 'parallel-row parallel-head';
  header.innerHTML = `<div class="cell">『抽斎年譜』</div><div class="cell">森鷗外『渋江抽斎』</div>`;
  table.appendChild(header);

  for (const p of pairs) {
    const row = document.createElement('div');
    row.className = 'parallel-row';
    row.innerHTML =
      `<div class="cell chron">${p.chron || '<span class="muted">（該当範囲の抽出なし）</span>'}</div>`
      + `<div class="cell novel">${p.novel}</div>`;
    const tag = document.createElement('div');
    tag.className = 'cn-key';
    tag.textContent = p.key;
    row.appendChild(tag);
    table.appendChild(row);
  }
  container.appendChild(table);
}
