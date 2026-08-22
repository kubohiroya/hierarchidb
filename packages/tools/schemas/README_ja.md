# @hierarchidb/tools-schemas

最終更新: 2026-04-05

HierarchiDB のスキーマ定義ツール。JSON Schema / TypeScript 型定義の生成・バリデーションを提供する。

## Plugin Manifest Schema

`plugin-manifest.schema.json` は最小限の公開 plugin manifest contract を定義する。
schema は `id`、`nodeType`、`version` を必須とし、root と nested extension area は意図的に許容的に保つ。
schema test は Ajv strict mode で実行し、型変換、既定値補完、追加プロパティ削除は行わない。

## ライセンス

MIT
