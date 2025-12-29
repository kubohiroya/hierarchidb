# shape/location/route のベクタタイル生成ステージを共通化する

この ExecPlan は生きた文書である。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` の各セクションは作業の進行に合わせて更新し続けること。

リポジトリルートの `PLANS.md` に従って本書を保守すること。

## Purpose / Big Picture

この変更により、shape/location/route の「タイル生成」ステージが共通の処理パイプラインを通るようになり、各プラグインは同じ実装を直接利用できる。ユーザー視点では、3 プラグインのビルド進捗ステージが一貫した `vectortile` で処理され、route でも実際にタイルが生成されることを確認できる。動作確認はプラグイン単体の typecheck と該当ユニットテストの通過で示す。

## Progress

- [x] (2025-12-29 11:36 JST) 共通化設計の確定（`packages/runtime-worker` に共通ユーティリティを配置）。
- [x] (2025-12-29 11:38 JST) 共通ベクタタイル生成ユーティリティを実装（`vectorTileStageRunner.ts` を追加し export）。
- [x] (2025-12-29 11:41 JST) shape の vectortile ステージを共通ユーティリティへ移行。
- [x] (2025-12-29 11:44 JST) location の vectortile ステージを共通ユーティリティへ移行。
- [x] (2025-12-29 11:48 JST) route の vectortile ステージを実装し、共通ユーティリティ経由でタイル生成を行う。
- [ ] (pending) 影響テスト/型チェックを実施し、結果を記録。

## Surprises & Discoveries

- Observation: まだなし。
  Evidence: なし。

## Decision Log

- Decision: 共通ベクタタイル生成ユーティリティは `packages/runtime-worker` に配置し、プラグインから直接利用する。
  Rationale: 既に shape/location が `@hierarchidb/runtime-worker` を利用しており、追加依存を増やさずに共通化できるため。
  Date/Author: 2025-12-29 / Codex

- Decision: 共通ユーティリティは `runVectorTileStage` と `writeVectorTileInput` の最小 API に限定し、各プラグインが進捗・ストア更新を直接扱う。
  Rationale: 進捗や DB 更新はプラグイン固有であり、共通化しすぎると責務が曖昧になるため。
  Date/Author: 2025-12-29 / Codex

- Decision: route の vectortile 生成は sessionId を inputBufferId として TilesDB に保存し、ズーム/バッファ設定は UI デフォルト値に合わせる。
  Rationale: RouteBatchConfig に vectorTiles 設定が無いため、最小の互換値で実装し UI の既定値と揃える。
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

- 「ベクタタイル生成ステージ」とは、バッチ処理の最終段階で GeoJSON から MVT タイルを生成し、ストアへ保存する処理を指す。本リポジトリでは stage 名 `vectortile` が使われる。
- shape の現状実装は `plugins/shape-plugin/src/services/batch/SessionController.ts` と `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` にある。GeoJSON 入力の作成・runtime-worker の `vectortile` client 呼び出し・タスクの進捗更新が散在している。
- location の現状実装は `plugins/location-plugin/src/services/batch/LocationSessionController.ts` の `generateTiles` にある。runtime-worker `vectortile` client に委譲後、結果を location の Dexie DB に戻し込んでいる。
- route の現状は `plugins/route-plugin/src/services/RouteBatchManager.ts` で `stage: 'vectortile'` を付与するのみで、実際のタイル生成は `plugins/route-plugin/src/services/RouteBatchSession.ts` の `optimization` が no-op。
- runtime-worker 側には `packages/runtime-worker/src/services/StageProcessingService.ts` があり、`vectortile.generateTiles` は `@hierarchidb/gis-sdk` の `generateVectorTilesFromJsonBuffer` を用いて TilesDB へ保存する。

## Plan of Work

1) 共通ユーティリティを `packages/runtime-worker/src/services/vectorTileStageRunner.ts` に新設し、プラグイン側が直接利用できる API を提供する。ここで「共通」とは、入力を chunk ストレージへ保存 → runtime-worker `vectortile` client を実行 → 必要であればタイルを取り出しストアへ保存、という一連の流れを統一することを意味する。

2) shape 側は `RuntimeWorkerVectorTileAdapter` の中で、既存の GeoJSON 変換ロジックは維持しつつ、タイル生成と結果処理を共通ユーティリティへ委譲する。タスク進捗や shapeDB 更新は shape 側で保持し、共通ユーティリティはタイル生成・取得に集中させる。

3) location 側は `LocationSessionController` の `generateTiles` で、共通ユーティリティを使ってタイル生成とタイル取り込みを行う。進捗イベント名は引き続き `tilegen` とし、ステージ名 `vectortile` への正規化は既存の runtimeBridge に委ねる。

4) route 側は `RouteBatchSession` の `optimization` で、route line string から GeoJSON を構築し、共通ユーティリティでタイル生成を実行する。生成結果は `@hierarchidb/gis-sdk` の TilesDB に保存されるため、`RouteQueryService` が取得できる状態になる。

5) 変更後に typecheck と該当ユニットテストを実行し、`TASKS.md` に結果を記録する。

## Concrete Steps

1) 共通ユーティリティ作成
  - 追加: `packages/runtime-worker/src/services/vectorTileStageRunner.ts`
  - 追加: `packages/runtime-worker/src/index.ts` から export
  - 実装概要:
      - `VectorTileStageInput` (inputBufferId, inputBuffer?, mime?, tile config, metadata)
      - `VectorTileStageHooks` (prepareInput?, onProgress?, importTile?)
      - `runVectorTileStage(inputs, client, hooks)` で generateTiles → listTiles → getTile → import の順に処理
      - chunk 保存は `DexieChunkStoragePort('hidb-chunks')` を使い、`inputBuffer` がある場合のみ書き込む

2) shape での利用
  - 変更: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`
  - 既存の `persistGeoJsonInput` で GeoJSON を ArrayBuffer に変換し、`runVectorTileStage` へ渡す
  - タスクの status 更新は既存の shapeDB 更新を維持

3) location での利用
  - 変更: `plugins/location-plugin/src/services/batch/LocationSessionController.ts`
  - `generateTiles` 内を `runVectorTileStage` 呼び出しに置換し、`importTile` で location DB に保存する

4) route での利用
  - 変更: `plugins/route-plugin/src/services/RouteBatchSession.ts`
  - `optimization` case を実装し、route line strings を GeoJSON FeatureCollection に変換
  - `runVectorTileStage` を呼び、`inputBufferId` に sessionId を用いる

5) テスト・検証
  - `pnpm --filter @hierarchidb/shape-plugin typecheck`
  - `pnpm --filter @hierarchidb/location-plugin typecheck`
  - `pnpm --filter @hierarchidb/route-plugin typecheck`
  - 失敗した場合はログを `TASKS.md` に記録し、原因と対応方針を追記

## Validation and Acceptance

- shape/location/route の typecheck が通ること。
- `RouteQueryService.getVectorTile` が TilesDB から取得できる状態であること（route の tile 生成が実装されたことを示す）。
- `vectortile` ステージの進捗が既存 UI で崩れないこと（手動確認または既存テストの通過で示す）。

## Idempotence and Recovery

- 変更は段階的に適用でき、各プラグインで `runVectorTileStage` を使わない旧ロジックへ戻すことで切り戻し可能。
- ロールバック時は変更した各プラグインファイルと共通ユーティリティを revert し、`TASKS.md` の記録を戻す。

## Artifacts and Notes

- 進捗や失敗ログは `TASKS.md` の運用ログに記録する。

## Interfaces and Dependencies

- `@hierarchidb/runtime-worker` に `runVectorTileStage` を追加し、プラグインは直接 import する。
- `DexieChunkStoragePort` は `@hierarchidb/download` から利用する。
- vector tile 生成の実処理は runtime-worker の `vectortile.generateTiles` が `@hierarchidb/gis-sdk` を利用する前提とする。

Plan change note: 実装着手に伴い Progress と Decision Log を更新し、route の設定方針を明記した。
