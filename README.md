# shift-spa

アルバイトのシフトを自動作成するBackendなしSPA。TypeScript + HTML + CSS (実行時依存なし)。

## 開発

- `npm install` → `npm run build` (`src/app.ts` → `js/app.js`)
- `npm test` (ビルド + 検証)

## 使うには

- **ブラウザで開くだけ (推奨)**: https://crazykohei0123.github.io/shift-spa/ にアクセスするだけ。インストール・サーバ不要。
- **ローカルで使う**: リポジトリをダウンロード (Code → Download ZIP) して `index.html` をブラウザで開くだけ。Webサーバの起動は不要。

## 使い方

1. **期間・シフト枠**: 開始〜終了日を指定、シフト枠 (名前・時間帯・人数・責任者数) を追加
2. **メンバー・休み希望**: 名前を追加、表のマスをクリックで「休」トグル、責任者に「責」チェック
3. **シフト結果**: 「自動作成」で割付。セル内の × で外す・選択肢で追加して微調整

## 出力

- **PNG出力**: 結果表を画像保存 (操作用UIは除外、2倍解像度)
- **CSVコピー**: クリップボードにコピー
- 印刷はブラウザの印刷機能 (印刷用CSSあり)

## データ保存

`localStorage` に自動保存。サーバ・DB不要。

## 割付ロジック

日付順の貪欲1パス: 休み除外 → 責任者優先 → 回数少 → 前日非勤務 → ランダム。不足は赤字で「要N」表示。

## 構成

- `index.html` — UI
- `css/style.css` — 表スタイル + 印刷用
- `src/app.ts` — ソース (TypeScript, `npm run build` で `js/app.js` に変換)
- `js/app.js` — ビルド成果物 (コミット済み、そのまま配信)
- `tests/` — Nodeスタブ検証 (`npm test`)
