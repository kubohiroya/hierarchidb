# @hierarchidb/import-export-api

最終更新: 2026-04-05

HierarchiDB のインポート/エクスポート API 型定義パッケージ。エクスポート形式型、インポートオプション、競合解決戦略等を定義する。

## ImportData Schema

このパッケージは JSON-like `ImportData<T>` payload の正規 JSON Schema として
`importDataJsonSchema` を export する。import envelope、node envelope、metadata、
draft metadata、再帰的な `children`、`version` を定義する。plugin が所有する
`data` / `draftData` は、意図的に generic JSON value としてのみ制約する。
portable payload は `parentNodeId` を含まない。import 先の配置は caller が
`targetParentId` で指定し、payload 内の階層は `children` で表現する。

## 依存関係

`@hierarchidb/core-types`

## 関連パッケージ

- [`@hierarchidb/import-export`](../import-export/) — インポート/エクスポート実装

## ライセンス

MIT
