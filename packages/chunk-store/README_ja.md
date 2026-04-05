# @hierarchidb/chunk-store

最終更新: 2026-04-05

HierarchiDB のチャンクベースデータストアパッケージ。Dexie（IndexedDB）を使用したキー・バリューチャンクストア（`DexieChunkStore`）と、Content-Addressable Store（CAS）を提供する。ダウンロードデータのキャッシュ・永続化に使用される。

## 主要な機能

- `DexieChunkStore<T>` — Dexie ベースのチャンクストア（get / put / delete / clear）
- `ContentAddressableStore` — ハッシュベースの CAS（fetchToCas でダウンロード→ハッシュ→永続化）
- `CacheAPICachePort` — Cache API アダプタ
- `DexieContentIndexPort` — Dexie ベースのコンテンツインデックス
- `NobleSha3HashPort` — SHA-3 ハッシュポート

## 依存関係

`@hierarchidb/core-types`, `@hierarchidb/download`, `@hierarchidb/util`

## 関連パッケージ

- [`@hierarchidb/tabular-store`](../tabular-store/) — 表形式データストア（行データのチャンク保存）
- [`@hierarchidb/download`](../download/) — ネットワークダウンロード

## ライセンス

MIT
