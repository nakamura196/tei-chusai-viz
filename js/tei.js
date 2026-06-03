// tei.js — TEI/XML を fetch して DOMParser で解析し、可視化用のデータモデルを組み立てる。
// 依存なし（ブラウザ標準の DOMParser を使用）。

export const TEI_NS = 'http://www.tei-c.org/ns/1.0';
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';

// --- 低レベルヘルパ ---------------------------------------------------------

export async function loadXML(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} の取得に失敗しました (${res.status})`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`XML パースエラー: ${err.textContent}`);
  return doc;
}

const tags = (node, name) => Array.from(node.getElementsByTagNameNS(TEI_NS, name));
const xmlId = (node) => node.getAttributeNS(XML_NS, 'id') || node.getAttribute('xml:id');
// corresp/target などのポインタ値を正規化（先頭 # を外す。# 欠落データにも耐える）。
const ref = (v) => (v ? v.replace(/^#/, '').trim() : null);
// 純テキスト（XML 整形用の空白を畳む。古典日本語は語間空白が無いので問題なし）。
const plain = (node) => (node ? node.textContent.replace(/\s+/g, '').trim() : '');

// 漢数字（1〜99）→ 整数。年齢「N歳」の解釈に使う。
const KANJI = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
export function kanjiToInt(s) {
  if (!s) return null;
  s = s.replace(/[０-９]/g, (d) => '０１２３４５６７８９'.indexOf(d)); // 全角→半角
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  let total = 0, section = 0, hasTen = false;
  for (const ch of s) {
    if (ch === '十') { section = (section || 1) * 10; hasTen = true; }
    else if (ch in KANJI) {
      if (hasTen) { total += section; section = KANJI[ch]; hasTen = false; }
      else section = section * 10 + KANJI[ch];
    }
  }
  total += section;
  return total || null;
}

// 数え年 → 西暦（抽斎は文化2年=1805年生まれ。一歳=1805）。
const BIRTH_YEAR = 1805;
const ageToYear = (age) => (age == null ? null : BIRTH_YEAR + age - 1);

// --- インライン TEI → 表示用 HTML ------------------------------------------
// ルビ・改行を保ちつつ、それ以外はテキストへ落とす（対訳ビューの可読性向上）。
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function renderInline(node) {
  let html = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      html += esc(child.nodeValue.replace(/\s+/g, ''));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const name = child.localName;
      if (name === 'ruby') {
        const rb = plain(tags(child, 'rb')[0] || child);
        const rt = plain(tags(child, 'rt')[0]);
        html += `<ruby>${esc(rb)}<rt>${esc(rt)}</rt></ruby>`;
      } else if (name === 'lb') {
        html += '<br>';
      } else if (name === 'note') {
        html += `<span class="inline-note">（${renderInline(child)}）</span>`;
      } else if (name === 'anchor' || name === 'milestone' || name === 'pb') {
        /* 表示なし */
      } else {
        html += renderInline(child); // persName/placeName/date/seg/span などは中身を再帰
      }
    }
  }
  return html;
}

// 2 つの空 <anchor> の間（同一文書順）にある内容を HTML 化して取り出す。
// matchStart/matchEnd は anchor 要素を判定する述語。
// 文書ルートから全ノードを文書順に走査し、start で取り込み開始・end で確実に停止する
// （currentNode を動かして部分木をスキップする方式は end を飛び越える事故があったため不採用）。
// 同一キーが複数区間に出現する場合（小説側に複数の対応箇所がある等）に備え、
// 一致する _s/_e を文書順に「すべて」収集し、i 番目どうしを対にして各区間を返す。
function extractBetween(doc, matchStart, matchEnd) {
  const anchors = tags(doc, 'anchor');
  const starts = anchors.filter(matchStart);
  const ends = anchors.filter(matchEnd);
  const out = [];
  const n = Math.min(starts.length, ends.length);
  for (let i = 0; i < n; i++) {
    const frag = spanBetween(doc, starts[i], ends[i]);
    if (frag) out.push(frag);
  }
  return out; // 区間ごとの HTML 配列（無ければ []）
}

// 2 つの空 <anchor>（start/end）の間の内容を HTML 化する。
function spanBetween(doc, start, end) {
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let html = '', started = false;
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n === start) { started = true; continue; }
    if (n === end) break;
    if (!started) continue;
    if (n.nodeType === Node.TEXT_NODE) {
      // ルビ内テキストは ruby 要素側でまとめて扱うため、ここでは二重に拾わない。
      const pn = n.parentNode && n.parentNode.localName;
      if (pn === 'rb' || pn === 'rt' || pn === 'ruby') continue;
      html += esc(n.nodeValue.replace(/\s+/g, ''));
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      if (n.localName === 'ruby') {
        const rb = plain(tags(n, 'rb')[0] || n);
        const rt = plain(tags(n, 'rt')[0]);
        html += `<ruby>${esc(rb)}<rt>${esc(rt)}</rt></ruby>`;
      } else if (n.localName === 'lb') {
        html += '<br>';
      }
      // その他の要素（persName/date/note など）はテキストノード訪問時に拾われる。
    }
  }
  return html;
}

// 人物 ID の表記ゆれを正規化する別名表（原データは改変せず、表示側で名寄せ）。
// レビューで同一人物と確認できたもののみ。岩田百合は同定保留（別名にしない）。
const PERSON_ALIAS = {
  '尾嶋定子': '尾島定子',
  '尾島定': '尾島定子',
  '山内五百': '山内五百子',
  '矢鳥玄碩': '矢島玄碩',
  '恒善': '渋江恒善',
};

// 「cn03_02」⇔「cn03_2」のようなゼロ詰め表記ゆれを吸収するためのキー候補。
function keyVariants(key) {
  const m = key.match(/^cn(\d+)_(\d+)$/);
  if (!m) return [key];
  const a = m[1], b = m[2];
  const set = new Set([
    `cn${a}_${b}`,
    `cn${parseInt(a, 10)}_${parseInt(b, 10)}`,
    `cn${a}_${parseInt(b, 10)}`,
    `cn${parseInt(a, 10)}_${b}`,
  ]);
  return [...set];
}

// --- データモデル構築 -------------------------------------------------------

export function buildModel(chronDoc, aozoraDoc) {
  // 1) listPerson（人物辞書）
  const persons = new Map(); // id -> {id,name,surname,forename,viaf,birth,death,note}
  for (const p of tags(chronDoc, 'person')) {
    const pn = tags(p, 'persName')[0];
    const id = xmlId(p) || (pn && xmlId(pn));
    if (!id) continue;
    const surname = plain(tags(p, 'surname')[0]);
    const forename = plain(tags(p, 'forename')[0]);
    const name = (surname + forename) || plain(pn) || id;
    const idno = tags(p, 'idno').find((n) => /viaf/i.test(n.getAttribute('type') || '') || /viaf/i.test(n.textContent));
    persons.set(id, {
      id, name, surname, forename,
      viaf: idno ? idno.textContent.trim() : null,
      birth: plain(tags(p, 'birth')[0]) || null,
      death: plain(tags(p, 'death')[0]) || null,
      note: plain(tags(p, 'note')[0]) || null,
    });
  }

  // 2) 各年次 div の西暦を決める。見出しは和暦年号（例「文化三年丙寅」）なので、
  //    div 内の <date when> の西暦を第一候補とし、無ければ見出し「N歳」から数え年で補う。
  const body = tags(chronDoc, 'body')[0];
  const yearOfDiv = new Map(); // div element -> 西暦
  const yearLabel = new Map(); // 西暦 -> 見出しラベル（例「文化三年丙寅（1806）」）
  const divYear = (div) => {
    const d = tags(div, 'date').find((x) => x.getAttribute('when'));
    if (d) { const y = parseInt((d.getAttribute('when') || '').slice(0, 4), 10); if (!isNaN(y)) return y; }
    const head = plain(tags(div, 'head')[0]);
    const m = head && head.match(/^(.+?)歳$/);
    const age = m && kanjiToInt(m[1]);
    return age ? ageToYear(age) : null;
  };
  for (const div of tags(body, 'div')) {
    const year = divYear(div);
    if (year == null) continue;
    yearOfDiv.set(div, year);
    const head = plain(tags(div, 'head')[0]);
    if (head && head !== '年譜' && !yearLabel.has(year)) yearLabel.set(year, `${head}（${year}）`);
  }

  // 3) 本文の persName 参照を年次へ割り当て、共起と登場年を集計。
  //    persName は文書順で得られるため、年次 div に内包されない body 直下の孤立 <note>
  //    内の参照は、直前に解決した年次を継承させて取りこぼしを防ぐ。
  const personYears = new Map();          // personId -> Set<year>
  const byYear = new Map();               // year -> Set<personId>
  let lastYear = null;
  for (const ref0 of tags(body, 'persName')) {
    const raw = ref(ref0.getAttribute('corresp'));
    if (!raw) continue;
    const pid = PERSON_ALIAS[raw] || raw; // 表記ゆれを正規化
    // 最寄りの年次 div を探す
    let div = ref0.parentNode, year = null;
    while (div && div !== body) {
      if (yearOfDiv.has(div)) { year = yearOfDiv.get(div); break; }
      div = div.parentNode;
    }
    if (year == null) year = lastYear;    // 孤立 note は直前の年次を継承
    if (year == null) continue;
    lastYear = year;
    if (!personYears.has(pid)) personYears.set(pid, new Set());
    personYears.get(pid).add(year);
    if (!byYear.has(year)) byYear.set(year, new Set());
    byYear.get(year).add(pid);
  }

  // 共起エッジ（同じ年次に登場する人物のペア。重みは共有年次数）
  const edgeW = new Map(); // "a|b" -> weight
  for (const ids of byYear.values()) {
    const arr = [...ids];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const [a, b] = [arr[i], arr[j]].sort();
        const k = `${a}|${b}`;
        edgeW.set(k, (edgeW.get(k) || 0) + 1);
      }
  }

  // ノード（登場した人物のみ）。次数（登場年数）で大きさを決める。
  const nodes = [];
  for (const [pid, years] of personYears) {
    const p = persons.get(pid);
    nodes.push({ id: pid, name: p ? p.name : pid, count: years.size, person: p || null });
  }
  const present = new Set(nodes.map((n) => n.id));
  const links = [];
  for (const [k, w] of edgeW) {
    const [a, b] = k.split('|');
    if (present.has(a) && present.has(b)) links.push({ source: a, target: b, weight: w });
  }
  // listPerson に未登録のまま残った被参照 ID（名寄せ後の残り。例: 岩田百合）。
  const unidentified = nodes.filter((n) => !persons.has(n.id)).map((n) => n.id);
  if (unidentified.length) console.warn('listPerson 未登録の被参照ID:', unidentified);

  // 4) 対訳ペア（chuusainenpu: xml:id=cnK_s/_e、aozora: corresp=#cnK_s/_e）
  const keys = new Set();
  for (const a of tags(chronDoc, 'anchor')) {
    const id = xmlId(a);
    const m = id && id.match(/^(cn\d+_\d+)_s$/);
    if (m) keys.add(m[1]);
  }
  const parallels = [];
  let withNovel = 0;
  for (const key of [...keys].sort()) {
    const chronFrags = extractBetween(chronDoc,
      (a) => xmlId(a) === `${key}_s`, (a) => xmlId(a) === `${key}_e`);
    // 小説側はゼロ詰め表記ゆれを吸収して探し、複数区間があればすべて拾う。
    let novelFrags = [];
    for (const v of keyVariants(key)) {
      const f = extractBetween(aozoraDoc,
        (a) => ref(a.getAttribute('corresp')) === `${v}_s`,
        (a) => ref(a.getAttribute('corresp')) === `${v}_e`);
      if (f.length) { novelFrags = f; break; }
    }
    const novel = novelFrags.join(' <span class="gap">〔…〕</span> ');
    if (novel) withNovel++;
    // 小説側が無くても年譜本文があれば「年譜のみ」行として残す（無言の脱落を防ぐ）。
    parallels.push({
      key,
      chron: chronFrags.join(' <span class="gap">〔…〕</span> '),
      novel,
      novelCount: novelFrags.length,
      chronOnly: !novel,
    });
  }

  return {
    persons,
    nodes,
    links,
    unidentified,
    personYears,
    years: [...byYear.keys()].sort((a, b) => a - b),
    yearLabel,
    byYear,
    parallels,
    parallelStats: { total: parallels.length, withNovel, chronOnly: parallels.length - withNovel },
  };
}
