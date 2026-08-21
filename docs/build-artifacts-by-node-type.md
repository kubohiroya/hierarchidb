# ツリーノード種別ごとのビルド成果物と保存先仕様

本ドキュメントは、ツリーノード種別（Shape/Route/Location）ごとに「中間生成物」と「ビルド結果」をどのDBに保存し、どのタイミングで削除されるかを明文化する。

## 用語

- 中間生成物: fetch/transform などビルド工程で生成される作業用データ。Step4 の削除設定や手動削除で消せることを前提とする。
- ビルド結果: MapLibreGL 表示やフィーチャー一覧で利用する成果物。ツリーノードが存在する間は原則保持する。

## 保存先の基本方針

- 旧 `VtShapeDb` は廃止し、中間生成物は `EphemeralShapeDB` に統合する。
- 旧 `VtDb` は廃止し、地図タイルは各ノード種別の永続DBに統合する。
- Route/Location の永続DBは未実装の可能性があるため、本仕様は実装方針として扱う。

## Shape の成果物

### 中間生成物

- 保存先: `EphemeralShapeDB`
- 想定内容:
  - fetch 生成物（raw/filtered FlatGeobuf）
  - zoom band 別の FlatGeobuf
  - simplify 後の FlatGeobuf
  - tileId -> featureId の転置インデックス
- 削除:
  - Step4 の手動削除ボタンで削除可能
  - Step4 の自動削除設定に従って削除可能

### ビルド結果

- 保存先: `ShapeDB`
- 想定内容:
  - 地図タイル（PBF）
  - フィーチャーごとのアウトライン LineString
  - フィーチャーごとのメタデータ
- 削除:
  - ツリーノードが存在する限り保持
  - Step4 の手動削除ボタンで削除可能

## Route の成果物

### 中間生成物

- 保存先: `EphemeralRouteDB` または `EphemeralShapeDB` に統合
- 想定内容:
  - fetch 生成物（LineString）
  - zoom band 別の FlatGeobuf
  - simplify 後の FlatGeobuf
  - tileId -> featureId の転置インデックス
- 削除:
  - Step4 の手動削除ボタンで削除可能（未実装の場合は追加）
  - Step4 の自動削除設定に従って削除可能（未実装の場合は追加）

### ビルド結果

- 保存先: `RouteDB`（未実装の可能性があるため新設前提）
- 想定内容:
  - 地図タイル（PBF）
  - 経路 LineString
  - フィーチャーごとのメタデータ
- 削除:
  - ツリーノードが存在する限り保持
  - Step4 の手動削除ボタンで削除可能（未実装の場合は追加）

## Location の成果物

### 中間生成物

- 保存先: 現状は専用 DB 未実装（必要時に `EphemeralLocationDB` を新設）
- 想定内容:
  - CSV/データソースの一時解析結果
- 削除:
  - 実装時に Step4 の手動削除ボタンで削除可能にする

### ビルド結果

- 保存先: `LocationDB`（features の永続化）
- 想定内容:
  - Point（LocationFeature）
  - フィーチャーごとのメタデータ（features 内 metadata）
- 削除:
  - ツリーノードが存在する限り保持
  - Step4 の手動削除ボタンで削除可能（未実装の場合は追加）

## CoreDB のツリーノード削除時の挙動

CoreDB でツリーノードが削除された場合、ノード種別に応じて以下の削除が必要となる。

- Shape: `EphemeralShapeDB` と `ShapeDB` の対象 `nodeId` データを削除
- Route: `EphemeralRouteDB` と `RouteDB` の対象 `nodeId` データを削除
- Location: `LocationDB` の対象 `nodeId` データを削除（Ephemeral は未実装）

## fetchWithAuth と外部URLのキャッシュ確認

現行の `smartFetch` は in-flight の重複リクエスト共有がある（`packages//src/smartFetch.ts`）。
ツリーノード単位のキャッシュは、`DexieChunkStore.getOrFetchForNode` / `setForNode` により実現されている。
以下の経路で nodeId 関係のキャッシュが稼働していることを確認済み。

- Shape: `plugins/shape-plugin/src/services/utils/chunkStore.ts` で `DexieChunkStore` を作成し、
  `plugins/shape-plugin/src/services/metadata/metadataSources.ts` や
  `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts` で `getOrFetchForNode` を使用。
  `ShapeQueryAPI.listSourceCaches` / `getSourceCache` が扱う「source cache」は、現行buildが
  download URLをkeyとして保存するraw source-download entry（および明示的なlegacy key modeの
  `download:` entry）だけである。同じChunkStore内の `geoboundaries:metadata:*` 等のmetadata entryは、
  手動の「API cache」件数・取得・削除対象に含めない。
- Route: `packages/runtime-worker/src/services/RouteMutationService.ts` で
  `getOrFetchForNode` により nodeId と URL の関係を保存。

Location については `getOrFetchForNode` の利用箇所を確認できていないため、nodeId 単位キャッシュの実装は未確認。
現状は `plugins/location-plugin/src/services/LocationBatchManager.ts` が `FetchNetworkPort` を直接利用しているため、
chunk-store による nodeId 関連キャッシュは未導入とみなす。

## 既存ドキュメントへの影響と対応方針

- `docs/vt-pipeline-design.md`: vt-shape-store/vt-route-store/vt-store 前提の記述があるため、**軽微な更新で対応**。
- `docs/vt-shape-pipeline-design.md`: vt-shape-store 前提のため、**別途書き直し対応**。
- `docs/vt-route-pipeline-design.md`: vt-route-store 前提のため、**別途書き直し対応**。
- `docs/shape-tileid-intersection-execplan.md`: vt-shape-store 前提の記述があるため、**別途書き直し対応**。
- `docs/shape-build-stage-flow.md`: VtShapeDb/VtDb の記載を削除済み。内容の再確認のみ実施。
- `docs/shape-build-stage-compare.md`: VtShapeDb/VtDb の記載を削除済み。内容の再確認のみ実施。

### 更新優先順

1. `docs/vt-pipeline-design.md`（全体方針の基準になるため最優先）
2. `docs/vt-shape-pipeline-design.md`（Shape 仕様の書き直しが必要）
3. `docs/vt-route-pipeline-design.md`（Route 仕様の書き直しが必要）
4. `docs/shape-tileid-intersection-execplan.md`（ExecPlanの前提修正が必要）
5. `docs/shape-build-stage-flow.md`（確認のみ）
6. `docs/shape-build-stage-compare.md`（確認のみ）
