# 抽斎年譜 TEI ビジュアライザ（二次利用例）

[若手図書館員DH勉強会『抽斎年譜』TEI/XML](https://github.com/dhlibrarianstudygroup/tei_chuusainenpu_public)（CC BY 4.0）の **二次利用例** です。同じ TEI/XML を別の角度から可視化し、オープンデータが再利用される様子をそのまま示すことを目的にしています。

公式ビューワ（本文・画像・人物カード等）: <https://chusaiweb-murata.netlify.app/>

## 3 つのビュー

| ビュー | 内容 | 使う TEI 要素 |
|---|---|---|
| **人物ネットワーク** | 同じ年次に登場する人物どうしを結んだ共起グラフ | `listPerson/person`、本文 `persName/@corresp` |
| **人物登場タイムライン** | 主要人物が抽斎の生涯のどの年に登場するか | `div`（年次）、`head`（年齢）、`persName/@corresp` |
| **年譜⇔渋江抽斎 対訳** | 年譜と森鷗外『渋江抽斎』の対応箇所を左右対照 | `anchor`（`cnN_s/_e`）、aozora 側 `anchor/@corresp` |

## 設計方針

- **静的サイト**。ブラウザ標準の `DOMParser` で TEI を直接読み込み、ビルド工程なしで動作します。
- **実行時の外部 CDN 依存なし**。可視化ライブラリ（d3 v7）は `vendor/` に同梱しています。
- データは `data/` に**改変せず**（aozora は別途修正 PR 済み）取り込み、出典を明記しています。

## ローカルで動かす

`fetch` を使うため、ファイルを直接開くのではなく簡易サーバ経由で開いてください。

```
cd tei-chusai-viz
python3 -m http.server 8000
```

→ ブラウザで <http://localhost:8000/>

## 公開（GitHub Pages）

リポジトリの Settings → Pages → Build and deployment で **Deploy from a branch** を選び、`main` / `(root)` を指定すれば公開されます（追加のワークフロー不要）。

## ライセンス

- **ソースコード**: MIT License（`LICENSE`）
- **`data/` 以下の TEI/XML**: 原データの [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) を継承。出典は若手図書館員DH勉強会。

## クレジット

- 原データ・公式ビューワ: 若手図書館員DH勉強会
- 底本: 『抽齋年譜』（東京大学総合図書館蔵 鴎H20:511）、森鷗外『渋江抽斎』（青空文庫）
