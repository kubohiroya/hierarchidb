# @hierarchidb/tabular-source-xlsx

最終更新: 2026-04-05

HierarchiDB の XLSX（Excel）データソース拡張パッケージ。`tabular-source` のパーサーレジストリに XLSX パーサーを追加する。`installTabularXlsx()` を呼び出すことで XLSX 形式のファイル取り込みが有効になる。

## 主要な機能

- `installTabularXlsx()` — XLSX パーサーの登録（一度だけ実行）
- `isTabularXlsxInstalled()` — 登録済みかどうかの判定

## 依存関係

`@hierarchidb/tabular-source`, `@hierarchidb/tabular-store`

## 関連パッケージ

- [`@hierarchidb/tabular-source`](../tabular-source/) — パーサーレジストリ（登録先）
- [`@hierarchidb/tabular-store`](../tabular-store/) — 表データストア

## ライセンス

MIT
