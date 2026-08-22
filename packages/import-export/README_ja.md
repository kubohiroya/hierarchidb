# @hierarchidb/import-export

最終更新: 2026-04-05

HierarchiDB のデータ入出力パッケージ。ツリー構造のシリアライズ/デシリアライズ、ノードデータのエクスポート、競合解決付きインポートを提供する。

## インポート検証

`ImportExportService.validateImportData` は、`@hierarchidb/import-export-api` の
`ImportData` JSON Schema により JSON-like import payload を検証する。validator は
型変換、既定値補完、追加プロパティ削除を行わない。root と node の envelope は厳密に検証し、
plugin が所有する `data` / `draftData` は generic JSON value として扱う。
import runtime が引き続き参照するため、node envelope には legacy placement metadata
である `parentNodeId` と top-level `tags` を含める。

## 公開 Export Artifact

`exportNodes({ format: 'json' })` が生成する JSON export は `json-export-envelope`
schema で検証する。Vector tile archive は返却前に `summary.json` を
`vector-tile-archive-summary` schema、`metadata.json` を
`vector-tile-archive-metadata` schema で検証する。

Export artifact validator は import validation と同じ no-coercion 方針で動作する。
契約違反は `EXPORT_ARTIFACT_SCHEMA_INVALID:<artifact>` で fail-closed とし、正規化、
丸め、デフォルト補完、未知フィールド削除は行わない。

CSV export と canonical YAML ZIP validation は別境界であり、この export artifact
schema の対象外とする。

## 依存関係

`@hierarchidb/core-types`, `@hierarchidb/import-export-api`, `@hierarchidb/tree-api`, `@hierarchidb/util`, `ajv`, `fflate`

## 関連パッケージ

- [`@hierarchidb/import-export-api`](../import-export-api/) — インポート/エクスポート API 型定義

## ライセンス

MIT
