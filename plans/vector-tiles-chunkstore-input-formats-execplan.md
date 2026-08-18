# Vector tile chunk-store input format expansion

このExecPlanは生きた文書であり、`Progress`・`Surprises & Discoveries`・`Decision Log`・`Outcomes & Retrospective`を常に更新する。`PLANS.md`（リポジトリ直下）に従って記述・更新すること。

## Purpose / Big Picture

shape/location/route のベクトルタイル生成において、chunk-store へ一時保存する素材フォーマットを `geojson` / `geojson+gzip` / `flatgeobuf` / `flatgeobuf+gzip` から選択できるようにする。選択された形式は chunk-store に保存され、runtime-worker 側で復号/デコードしてタイル生成へ渡される。既定は現状どおり `geojson`（非 gzip）で動作し、設定が無い場合は互換性を維持する。開発者は設定値を切り替えることで、入力素材のサイズや処理経路の差を確認できる。

## Progress

- [x] (2026-01-03 19:10 JST) ExecPlan を作成した。
- [x] (2026-01-03 19:22 JST) runtime-worker の chunk-store 入力書き込み/読み出しに gzip 圧縮・解凍と inputFormat/inputCompression を追加した。
- [x] (2026-01-03 19:24 JST) gis-sdk に FlatGeobuf 生成ユーティリティを追加し、location/route の入力生成に再利用した。
- [x] (2026-01-03 19:30 JST) shape/location/route の入力バッファ生成と config 配線を更新した（入力フォーマット選択）。
- [x] (2026-01-03 19:31 JST) 型定義（plugin-service-api / route-store / location-store / shape config）を更新した。
- [ ] テスト/検証手順と GitHub Issue の運用ログ・ロールバック手順を更新する（完了: なし／残り: 記録・検証）。

## Surprises & Discoveries

- なし（作業開始時点）。

## Decision Log

- Decision: inputFormat と inputCompression（gzip/none）は runtime-worker の API と chunk-store 書き込みに追加し、worker 側で解凍してから gis-sdk に渡す。
  Rationale: chunk-store の contentType だけでは復号情報を確実に渡せないため、明示的な config を持たせる必要がある。
  Date/Author: 2026-01-03 / Codex
- Decision: FlatGeobuf エンコードは gis-sdk に追加し、location/route がそれを利用する。
  Rationale: plugin 間で重複した FlatGeobuf 生成実装を増やさず、shared パッケージに集約するため。
  Date/Author: 2026-01-03 / Codex

## Outcomes & Retrospective

- 未完了。実装完了時に目的との差分、残課題、学びを記載する。

## Context and Orientation

現在の vector tile 生成は `packages/runtime-worker/src/services/vectorTileStageRunner.ts` が chunk-store に `application/json` の GeoJSON バッファを保存し、`StageProcessingService` が `readAll` で読み出して `generateVectorTilesFromJsonBuffer` に渡している。Shape は `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` で flatgeobuf を GeoJSON に変換し、Location/Route はそれぞれ JSON を直接生成している。Route の `RouteVectorTileService` は chunk-store を直接利用しているため、ここにも新しい入力形式の配線が必要である。

## Plan of Work

まず runtime-worker に inputFormat/inputCompression を追加し、chunk-store への書き込み時に gzip 圧縮を行えるようにする。`writeVectorTileInput` と `runVectorTileStage` に圧縮オプションを追加し、`StageProcessingService` は `inputCompression` に応じて `DecompressionStream('gzip')` で解凍してから gis-sdk の `generateVectorTilesFromJsonBuffer` / `generateVectorTilesFromFgbBuffer` に渡す。

次に gis-sdk に FlatGeobuf エンコード関数を追加し、`packages//src/vectorTiles.ts` と `packages//src/index.ts` で export する。これを location/route の入力バッファ生成に利用する。

最後に shape/location/route の設定とタスク入力型に inputFormat/inputCompression を追加し、各パイプラインが指定に応じて GeoJSON/FlatGeobuf の入力バッファを生成して runtime-worker に渡す。Route の `RouteVectorTileService` は chunk-store 直接書き込みを `writeVectorTileInput` に置き換える。

## Concrete Steps

1) runtime-worker の `packages/runtime-worker/src/services/vectorTileStageRunner.ts` に inputCompression 追加と gzip 圧縮処理を実装する。`packages/runtime-worker/src/services/StageProcessingService.ts` で gzip 解凍を追加する。必要なら `vitest.setup.base.ts` に `DecompressionStream` モックを追加する。

2) gis-sdk の `packages//src/vectorTiles.ts` に FlatGeobuf エンコード関数を追加し、`packages//src/index.ts` で export する。

3) shape/location/route の入力生成を更新する。
   - shape: `plugins/shape-plugin/src/common/types/ObsolateBuildConfig.ts` と `plugins/shape-plugin/src/services/batch/session/tiles/vectorTileTasks.ts` に inputFormat/inputCompression を追加し、`RuntimeWorkerVectorTileAdapter` で `inputFormat` に応じて GeoJSON/FlatGeobuf を生成する。
   - location: `packages//src/index.ts` の `LocationTileSettings` に inputFormat/inputCompression を追加し、`plugins/location-plugin/src/services/batch/LocationSessionController.ts` で inputFormat に応じたバッファ生成を行う。
   - route: `packages//src/index.ts` の `RouteProcessingConfig.vectorTiles` と `plugins/route-plugin/src/services/RouteVectorTileService.ts` / `RouteBatchSession.ts` に inputFormat/inputCompression を追加し、chunk-store 書き込みを `writeVectorTileInput` に集約する。

4) plugin-service-api の `packages/plugin-service-api/src/types/shapeBuildTypes.ts` に inputFormat/inputCompression を追加する。

## Validation and Acceptance

- 手動確認: shape/location/route で inputFormat を `geojson` と `flatgeobuf` に切り替え、`inputCompression: 'gzip'` を指定した場合に runtime-worker が正常にタイル生成できることを確認する。
- テスト（可能なら）: `pnpm --filter @hierarchidb/shape-plugin test -- --run VectorTileGeneration` を実行し、既存の GeoJSON 既定経路が失敗しないことを確認する。location/route のユニットテストがある場合は必要に応じて追加で実行する。

## Idempotence and Recovery

- 追加した inputFormat/inputCompression は既定値が `geojson` / `none` であるため、設定が無い場合の挙動は維持される。
- ロールバックは該当ファイルの差分を revert し、vector tile 入力が JSON のみの経路に戻すことで実現できる。GitHub Issue に戻し先のファイルを列挙する。

## Artifacts and Notes

- gzip 圧縮の確認では、chunk-store に保存されるサイズが明確に縮小していることを確認材料にする。

## Interfaces and Dependencies

- runtime-worker API: `VectorTileWorkerAPI.generateTiles` の config に `inputFormat` / `inputCompression` を追加する。
- gis-sdk: FlatGeobuf エンコード関数（例: `encodeFlatGeobufFromFeatureCollection`）を追加し、location/route が利用する。

変更履歴: 2026-01-03 19:10 JST - 初版作成（inputFormat/inputCompression の導入方針を記載）。
