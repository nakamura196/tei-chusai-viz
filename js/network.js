// network.js — 人物共起ネットワーク（同じ年次に登場した人物どうしを結ぶ）。
// d3 はグローバル（vendor/d3）を利用。

export function renderNetwork(container, model) {
  container.innerHTML = '';
  const width = container.clientWidth || 900;
  const height = 640;

  const nodes = model.nodes.map((d) => ({ ...d }));
  const links = model.links.map((d) => ({ ...d }));

  const maxCount = d3.max(nodes, (d) => d.count) || 1;
  const r = d3.scaleSqrt().domain([1, maxCount]).range([4, 22]);
  const maxW = d3.max(links, (d) => d.weight) || 1;
  const lw = d3.scaleLinear().domain([1, maxW]).range([0.5, 4]);

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.2, 5]).on('zoom', (e) => g.attr('transform', e.transform)));

  const link = g.append('g').attr('stroke', '#bbb').attr('stroke-opacity', 0.6)
    .selectAll('line').data(links).join('line')
    .attr('stroke-width', (d) => lw(d.weight));

  const node = g.append('g').selectAll('g').data(nodes).join('g').style('cursor', 'pointer');

  node.append('circle')
    .attr('r', (d) => r(d.count))
    .attr('fill', (d) => (d.person && d.person.viaf ? '#b5651d' : '#7a9eb1'))
    .attr('stroke', '#fff').attr('stroke-width', 1.2);

  node.append('text')
    .text((d) => d.name)
    .attr('x', (d) => r(d.count) + 3).attr('y', 4)
    .attr('font-size', 11).attr('fill', '#333')
    .style('display', (d) => (d.count >= 3 ? null : 'none')); // 主要人物のみ常時ラベル

  node.append('title').text((d) => {
    const p = d.person || {};
    return [d.name, `登場年数: ${d.count}`, p.birth && `生: ${p.birth}`, p.death && `没: ${p.death}`,
      p.note, p.viaf && `VIAF: ${p.viaf}`].filter(Boolean).join('\n');
  });

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(60).strength((d) => 0.05 + 0.02 * d.weight))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius((d) => r(d.count) + 6));

  sim.on('tick', () => {
    link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  node.call(d3.drag()
    .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

  // 凡例
  const legend = document.createElement('p');
  legend.className = 'legend';
  legend.innerHTML = `人物 ${nodes.length} 名 / 共起 ${links.length} 関係。`
    + `円の大きさ＝登場年数、<span style="color:#b5651d">●</span> VIAF 同定済み、`
    + `<span style="color:#7a9eb1">●</span> その他。ドラッグ／ズーム可。`;
  container.appendChild(legend);
}
