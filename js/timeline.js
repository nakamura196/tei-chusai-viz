// timeline.js — 人物登場タイムライン。
// 各人物（行）が、抽斎の生涯のどの年に登場するかをドットで示す。

export function renderTimeline(container, model, topN = 25) {
  container.innerHTML = '';
  const years = model.years;
  if (!years.length) { container.textContent = '年次データがありません。'; return; }

  // 登場年数の多い順に上位 topN 人物を抽出
  const people = model.nodes
    .filter((n) => n.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
    .slice(0, topN);

  const minY = years[0], maxY = years[years.length - 1];
  const margin = { top: 30, right: 24, bottom: 28, left: 130 };
  const rowH = 22;
  const width = Math.max(container.clientWidth || 900, 720);
  const innerW = width - margin.left - margin.right;
  const height = margin.top + margin.bottom + people.length * rowH;

  const x = d3.scaleLinear().domain([minY, maxY]).range([0, innerW]);

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', `人物登場タイムライン。上位${people.length}名が${minY}〜${maxY}年のどの年に登場するかを表示。`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // 上下の年軸（10年刻みの目盛り）
  const ticks = x.ticks(Math.min(10, maxY - minY));
  const axis = (yPos) => g.append('g').attr('transform', `translate(0,${yPos})`)
    .call(d3.axisTop(x).tickValues(ticks).tickFormat(d3.format('d')))
    .call((sel) => sel.selectAll('text').attr('font-size', 10));
  axis(-6);

  // 年グリッド
  g.append('g').selectAll('line').data(ticks).join('line')
    .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
    .attr('y1', -2).attr('y2', people.length * rowH)
    .attr('stroke', '#eee');

  const rows = g.selectAll('.row').data(people).join('g')
    .attr('class', 'row')
    .attr('transform', (d, i) => `translate(0,${i * rowH})`);

  rows.append('text').text((d) => d.name)
    .attr('x', -8).attr('y', rowH / 2 + 4).attr('text-anchor', 'end')
    .attr('font-size', 12).attr('fill', '#333');

  rows.append('line')
    .attr('x1', 0).attr('x2', innerW).attr('y1', rowH / 2).attr('y2', rowH / 2)
    .attr('stroke', '#f3f3f3');

  rows.each(function (d) {
    const ys = [...(model.personYears.get(d.id) || [])].sort((a, b) => a - b);
    const color = !d.person ? '#999' : d.person.viaf ? '#0b8bee' : '#6db9f5';
    const viaf = d.person && d.person.viaf;
    d3.select(this).selectAll('circle').data(ys).join('circle')
      .attr('cx', (yr) => x(yr)).attr('cy', rowH / 2).attr('r', 4)
      // VIAF同定済=塗り、その他=中空リング（色＋塗り分けで冗長化）
      .attr('fill', viaf ? color : '#fff')
      .attr('stroke', color).attr('stroke-width', 1.5)
      .append('title').text((yr) => `${d.name} — ${model.yearLabel.get(yr) || yr}`);
  });

  const legend = document.createElement('p');
  legend.className = 'legend';
  legend.innerHTML = `登場年数 上位 ${people.length} 名。横軸は西暦（抽斎 ${minY}–${maxY} 年）。`
    + `各点＝その年の年譜記事で言及。塗り=VIAF同定済み、中空=その他。`;
  container.appendChild(legend);
}
