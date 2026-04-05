# @hierarchidb/tabular-source

最終更新: 2026-04-05

HierarchiDB の表形式データパース・取り込みパッケージ。`TabularService`（検出→パース→取り込み）、CSV/TSV/JSONL パーサー、プロセッサ（列リネーム・数値変換・必須列バリデーション）、データソース登録機能を提供する。

## 主要な機能

- `TabularService` — ファイル形式検出（detect）、パース（parse）、取り込み（ingest）の統合サービス
- CSV / TSV / JSONL パーサー（`TabularParserPort` 実装）
- プロセッサ: `createColumnRenameProcessor`, `createNumberCoerceProcessor`, `createRequiredColumnsValidator`
- `registerTabularSource` / `isTabularSource` — nodeType 別のデータソース登録・判定

## 依存関係

`@hierarchidb/util`

## 関連パッケージ

- [`@hierarchidb/tabular-store`](../tabular-store/) — パース結果の永続化先
- [`@hierarchidb/tabular-source-xlsx`](../tabular-source-xlsx/) — XLSX パーサー拡張

## ライセンス

MIT
