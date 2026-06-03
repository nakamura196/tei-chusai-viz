// insights.js — 各ビューから「読み取れること（例）」を、モデルから動的に算出して提示する。
// 数値はその場で計算するため、データが変わっても表示は自動で追従する。
// 解釈上の注意（共起の定義の限界・言及年の性質など）も併記する。

const nm = (model, id) => { const p = model.persons.get(id); return p ? p.name : id; };

function networkStats(model) {
  const deg = new Map();
  for (const l of model.links) {
    const a = typeof l.source === 'object' ? l.source.id : l.source;
    const b = typeof l.target === 'object' ? l.target.id : l.target;
    deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1);
  }
  const byDeg = [...deg.entries()].sort((x, y) => y[1] - x[1]);
  const byApp = [...model.nodes].sort((a, b) => b.count - a.count);
  const pairs = [...model.links].map((l) => ({
    a: typeof l.source === 'object' ? l.source.id : l.source,
    b: typeof l.target === 'object' ? l.target.id : l.target, w: l.weight,
  })).sort((x, y) => y.w - x.w);
  const w1 = model.links.filter((l) => l.weight === 1).length;
  return { byDeg, byApp, pairs, w1 };
}

function box(title, items, caveats) {
  return `<aside class="insights"><h3>${title}</h3><ul>`
    + items.map((t) => `<li>${t}</li>`).join('')
    + `</ul><div class="caveat"><b>読み取りの注意</b><ul>`
    + caveats.map((c) => `<li>${c}</li>`).join('')
    + `</ul></div></aside>`;
}

export function insightsFor(key, model) {
  if (key === 'network') {
    const { byDeg, byApp, pairs, w1 } = networkStats(model);
    const topDeg = byDeg.slice(0, 3).map(([id, d]) => `${nm(model, id)}（${d}人と接続）`).join('、');
    const topApp = byApp.slice(0, 3).map((n) => `${n.name}（${n.count}年）`).join('、');
    const topPairs = pairs.slice(0, 3).map((p) => `${nm(model, p.a)}—${nm(model, p.b)}（${p.w}年）`).join('、');
    const pct = Math.round((w1 / model.links.length) * 100);
    return box('このネットワークから読み取れること（例）', [
      `最も多くの人物とつながるのは <b>${topDeg}</b>。年譜の記述が集まる中心人物が見える。`,
      `登場年数が多いのは <b>${topApp}</b>。`,
      `共有年次が多いペアは <b>${topPairs}</b>。渋江家と弘前藩主（津軽家）が同じ年に頻繁に現れることは、両家の主従関係と<strong>整合的</strong>だが、それ自体が交流を証明するものではない。`,
    ], [
      `エッジは「同じ年次に年譜へ登場した」共起にすぎず、直接の交流・血縁・師弟を意味しない。`,
      `各年内は全員総当たりで結ぶ方式のため、記述の濃い年（例: 1814年は13名→78本）が機械的に多数のエッジを生む。実際エッジの約 <b>${pct}%</b> は単年共起（重み1）で、次数は「多くの年に登場した」ことの言い換えに近い。`,
      `円サイズ=登場年数（史料での言及頻度であり歴史的重要度ではない）。色=VIAF同定の有無（研究上の名寄せ状態であり人物の格付けではない）。`,
      model.unidentified && model.unidentified.length
        ? `listPerson に未登録の被参照（${model.unidentified.join('、')}）は灰枠で別表示。原データの表記ゆれ等に由来する。` : '',
    ].filter(Boolean));
  }
  if (key === 'timeline') {
    const perYear = [...model.byYear.entries()].map(([y, s]) => [y, s.size]);
    const peaks = [...perYear].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([y, c]) => `${model.yearLabel.get(y) || y}：${c}名`);
    return box('このタイムラインから読み取れること（例）', [
      `登場人物が多い年は <b>${peaks.join('、')}</b>。年譜記述の濃淡（出来事の集中）が一目で分かる。`,
      `各人物がどの時期に現れ・退場するかを横並びで比較でき、抽斎の生涯における人間関係の移り変わりを追える。`,
    ], [
      `点は「その人物がその年の年譜記事で言及された年」を示す。祖先の生年・子孫の没年など回顧的な言及を含み、本人がその年に活動したとは限らない。`,
      `年次は各記事の見出し年（抽斎の数え年に基づく）で割り当てており、満年齢ではない。`,
      `登場数の多い上位 ${Math.min(25, model.nodes.length)} 名のみ表示している。`,
    ]);
  }
  if (key === 'parallel') {
    const lens = model.parallels.map((p) => ({
      key: p.key,
      c: p.chron.replace(/<[^>]+>/g, '').length,
      n: p.novel.replace(/<[^>]+>/g, '').length,
    })).filter((x) => x.c > 0 && x.n > 0);
    const exp = [...lens].sort((a, b) => (b.n / b.c) - (a.n / a.c))[0];
    const longer = lens.filter((x) => x.n > x.c).length;
    return box('この対訳から読み取れること（例）', [
      `年譜の簡潔な記述が、森鷗外『渋江抽斎』では物語として膨らんでいる例が多い（${lens.length} 件中 <b>${longer}</b> 件で小説側が長い）。`,
      exp ? `最も顕著な例は <code>${exp.key}</code>：年譜 ${exp.c} 字 → 小説 ${exp.n} 字（約 ${Math.round(exp.n / exp.c)} 倍）。事実の核が逸話や考証を伴う叙述へ展開される。` : '',
      `日付・人物・出来事という年譜の「骨格」が、小説でどう肉付けされたかを一次資料レベルで確認できる。`,
    ].filter(Boolean), [
      `対応づけは TEI の anchor/@corresp に基づく（全 ${model.parallelStats.total} 件、うち ${model.parallelStats.chronOnly} 件は青空側アンカー不足で年譜のみ）。`,
      `現代語訳は AI による下書きで、固有名詞・年号を含め未校閲。原典の解釈を保証しない。`,
      `小説側に複数の対応箇所がある記事は原文を〔…〕で連結表示し、現代語訳は冒頭区間のみとしている。`,
    ]);
  }
  return '';
}
