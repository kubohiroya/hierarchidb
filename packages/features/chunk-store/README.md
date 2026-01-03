# @hierarchidb/chunk-store

URL をキーにしたチャンク保存ストアを提供するパッケージです。Dexie の DB/テーブルとシリアライザ/デシリアライザを注入できるため、各プラグイン側で保存先やデータ形式を制御できます。ネットワーク取得は `@hierarchidb/download` の `FetchNetworkPort` を利用し、必要に応じて条件付き GET を行います。relation テーブルで `nodeId` との参照関係を保持し、参照が 0 になった場合のみ削除されます。

## 目的
- ダウンロード前後のキャッシュ（URL キー）をプラグイン側で明示的に扱えるようにする。
- 保存先の Dexie DB/テーブルを外部から渡せるようにする。
- データ形式（JSON / text / binary）をシリアライザ/デシリアライザで注入する。
- 参照元の `nodeId` と紐づけて relation を管理する。

## 公開 API（概要）
- `DexieChunkStore<T>`: Dexie バックエンドのチャンクストア実装（`setForNode` / `getOrFetchForNode` / `deleteForNode`）。
- `ChunkStoreSerializer<T>` / `ChunkStoreDeserializer<T>`: 変換関数型。
- `ChunkStoreFetchOptions`: `Accept` / 条件付き GET 用のオプション。
- `ChunkStoreIdentity`: URL/ETag/URL+ETag/Hash の同値性ルール。
- `metadataId` は UUID で発番され、relation は `{ nodeId, metadataId }` で管理する。

## 典型的な使い方
- JSON の場合は `serializer: value => JSON 文字列を ArrayBuffer 化`、`deserializer: ArrayBuffer を JSON.parse` を注入する。
- 文字列の場合は `TextEncoder` / `TextDecoder` を使って注入する。
- バイナリの場合は `ArrayBuffer` をそのまま返すシリアライザ/デシリアライザを注入する。
- 参照元 `nodeId` を指定して `getOrFetchForNode` / `setForNode` を呼び出す。
- `identity` を `url+etag` にすると、同一 ETag のデータが重複保存されない。
