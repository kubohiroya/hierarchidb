# @hierarchidb/tabular-store

最終更新: 2026-04-05

HierarchiDB の表形式データ永続化パッケージ。`TabularWriter`（チャンク書き込み）、`RowStoreDB`（行データの Dexie ストア）、`TabularDatabaseManager`（メタデータ管理）、`TabularQueryService`（フィルタクエリ）、`TabularIndexer`（列インデックス）を提供する。spreadsheet-plugin / styler-plugin / shape-plugin / location-plugin / route-plugin が共通で使用する。

## 主要な機能

- `TabularWriter` — 表データのチャンク書き込み（begin → writeRows → flush/commit）
- `RowStoreDB` — Dexie ベースの行データストア（チャンク単位で永続化）
- `TabularDatabaseManager` — テーブルメタデータの CRUD・参照カウント管理
- `TabularQueryService` — フィルタ条件による行データクエリ
- `TabularIndexer` — 列値の等値インデックス（遅延作成）

`RowStoreDB`、`TabularWriter`、`TabularIndexer`、`TabularQueryService`には同一の完全なrow-storeデータベース名を明示的に渡す。package内でbuild prefixを推定したりfallbackしたりしない。

## 依存関係

`@hierarchidb/util`

## 関連パッケージ

- [`@hierarchidb/tabular-source`](../tabular-source/) — 表データのパース・取り込み
- [`@hierarchidb/chunk-store`](../chunk-store/) — チャンクストア基盤

## ライセンス

MIT
