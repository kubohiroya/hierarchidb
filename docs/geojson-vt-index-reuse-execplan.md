# extract2 で geojson-vt index を保存し vectortile で再利用する計画

この ExecPlan は生きた文書です。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` は作業の進行に合わせて更新します。

本計画はリポジトリ直下の `PLANS.md` に従って管理します。

## Purpose / Big Picture

extract2 ステージで geojson-vt の index オブジェクトを生成して IndexedDB に保存し、vectortile ステージで復元して再利用することで、タイルごとに index を再生成していた無駄を削減します。実装後は、vectortile の処理が進んでいるときに「index built」相当の処理が走らず、既存の tileId relations に基づいて保存済み index からタイルを直接生成できるようになります。

## Progress

- [x] (2026-01-11 04:25 JST) 現状コードと idb-geojson-vt-test.html を確認し、計画の骨子を作成した。
- [x] (2026-01-11 04:50 JST) extract2 の入力に vectorTiles 設定を渡すための型とタスク構築を更新した。
- [x] (2026-01-11 05:05 JST) EphemeralShapeDB に geojson-vt index 保存用のテーブルと API を追加した。
- [x] (2026-01-11 05:25 JST) extract2 で index を生成して保存し、vectortile で復元して再利用する処理を実装した。
- [ ] 検証ログと最小限の動作確認を行い、Progress/Decision/Outcomes を更新する。

## Surprises & Discoveries

- Observation: geojson-vt index は IndexedDB に structured clone 保存し、prototype を戻せば getTile が動作する。
  Evidence: `app/public/idb-geojson-vt-test.html` の検証コードとコンソール出力。

## Decision Log

- Decision: geojson-vt index は `packages/features/shape-store/src/EphemeralShapeDB.ts` の新テーブルに保存する。
  Rationale: 既存の extract2/ vectortile のデータと同じ ephemral DB で管理し、クリアや統計処理と一緒に扱えるため。
  Date/Author: 2026-01-11 / Codex

- Decision: index の再利用は metadataEnabled=false のタイル生成のみ対象とし、対応外の場合は明示的にエラーで停止する。
  Rationale: metadata 集計は GeoJSON 全走査を前提にしており index だけでは再現できないため。フォールバックを避けるため明示的に停止する。
  Date/Author: 2026-01-11 / Codex

- Decision: index が存在しない場合は旧来の per-tile index 生成に戻らず、タスク失敗として扱う。
  Rationale: フォールバック禁止の方針に従い、extract2 で必ず index を生成することを前提にする。
  Date/Author: 2026-01-11 / Codex

- Decision: tile タスクは runtime-worker の generateTiles を使わず、encode 済みのタイルを storeTiles で保存する。
  Rationale: vectortile ステージの index 再生成を避け、tile 1 枚の生成に限定したい。
  Date/Author: 2026-01-11 / Codex

## Outcomes & Retrospective

実装は完了し、検証のみ未実施。動作確認後に達成内容を追記する。

## Context and Orientation

現在の処理は extract2 ステージで `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` が GeoJSON/FlatGeobuf を生成し、`buildTileIdRelations()` で tileId relations を保存しています。vectortile ステージは `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` が tileId relations を参照し、保存済みの geojson-vt index を復元してタイルを生成し、`packages/runtime-worker/src/services/StageProcessingService.ts` の `storeTiles()` で保存する経路へ更新済みです。従来の `generateTiles()` 経路はタイルタスクでは使われず、index 再生成は発生しません。

`app/public/idb-geojson-vt-test.html` には geojson-vt index を IndexedDB に保存し、`Object.setPrototypeOf()` で復元する実験コードがあり、今回の実装でこれを再利用します。

## Plan of Work

まず、extract2 タスクに vectortile 設定（buffer/extent/zoom レンジ）を渡すため、`packages/plugin-service-api/src/types/shapeBatchTypes.ts` の `ShapeExtract2TaskInputData` に `vectorTileBuffer`、`vectorTileExtent`、`vectorTileMaxZoom` のようなフィールドを追加し、`plugins/shape-plugin/src/services/batch/session/extract2/buildExtract2TasksFromExtract1.ts` と `plugins/shape-plugin/src/services/batch/session/extract2/topojsonGrouping.ts` で設定を入力に埋め込みます。ここでの設定値は `BatchProcessConfig.vectorTiles` と `ShapeVectorTileTaskInputData` が使用している `buffer`/`extent` と同じ値に揃えます。

次に、`packages/features/shape-store/src/EphemeralShapeDB.ts` に geojson-vt index を格納するテーブルを追加します。レコード型には `id`、`nodeId`、`bufferId`、`index`、`options`、`createdAt` を含め、`clearStage()` と `clearNodeData()` で extract2 と一緒に削除されるようにします。これに合わせて `packages/plugin-service-api/src/types/shapeDbTypes.ts` と `packages/plugin-service-api/src/types/ShapeEphemeralDBAPI.ts` を更新し、`plugins/shape-plugin/src/services/batch/ShapeBatchApiClient.ts` に `putGeojsonVtIndex()` と `getGeojsonVtIndex()` を実装します。

extract2 ステージでは `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` の `processExtract2Task()` 内で `finalFeatures` が確定した後に geojson-vt index を作成し、上記 API を通じて保存します。index の生成オプションは vectortile と同じ `extent=4096`、`buffer=vectorTileBuffer`、`indexMaxZoom=max(zoomLevels)` を使い、`promoteId: 'id'` を指定します。保存時に `Object.getPrototypeOf(index)` の復元用プロトタイプは持たず、保存後の復元側で geojson-vt を一度呼び出してプロトタイプを得る方針にします。

vectortile ステージでは `RuntimeWorkerVectorTileAdapter` を変更し、タイルタスク (`tileZ/tileX/tileY` がある場合) は `assembleTileGeoJSON()` を使わず、`getShapeDbApiClient().ephemeral.listTileIdRelationsByTileId()` で関係する `bufferId` を取得し、その各 bufferId の geojson-vt index を `getGeojsonVtIndex()` で読み込みます。読み出した index は `Object.setPrototypeOf()` で復元し、`index.getTile(z, x, y)` を呼び出してタイルを得ます。複数の index がある場合は、各 tile の `features` を一つの配列に結合し、`@maplibre/vt-pbf` で単一の `layer0` としてエンコードします。これにより per-tile index 生成を回避し、tile 生成だけを行います。metadataEnabled が true の場合はこの経路を通さず、対応外としてタスクを失敗させます。

runtime-worker 側の `packages/runtime-worker/src/services/StageProcessingService.ts` には、tile 生成済みの `Uint8Array` を `storeVectorTiles()` に渡すための新しいメソッドを追加するか、既存 `storeVectorTiles()` を使えるように `VectorTileWorkerAPI` に「エンコード済みタイルを保存する」メソッドを追加して adapter から呼び出せるようにします。既存の `generateTiles()` の経路は tile タスクに対して使わないため、geojson-vt index の再生成は発生しません。

## Concrete Steps

作業ディレクトリはリポジトリ直下です。

1) 型とタスク構築を確認するために次を実行し、extract2 入力に vectortile 設定を追加する箇所を特定する。
   - `rg -n "ShapeExtract2TaskInputData" packages/plugin-service-api/src/types/shapeBatchTypes.ts`
   - `rg -n "buildExtract2Tasks" plugins/shape-plugin/src/services/batch/session/extract2`

2) EphemeralShapeDB のスキーマに geojson-vt index テーブルを追加し、ShapeBatchApiClient と API 型を更新する。
   - `packages/features/shape-store/src/EphemeralShapeDB.ts`
   - `packages/plugin-service-api/src/types/shapeDbTypes.ts`
   - `packages/plugin-service-api/src/types/ShapeEphemeralDBAPI.ts`
   - `plugins/shape-plugin/src/services/batch/ShapeBatchApiClient.ts`

3) extract2 に index 生成と保存を追加する。
   - `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`

4) vectortile ステージで index を復元してタイルを生成し、保存する経路を追加する。
   - `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`
   - `packages/runtime-worker/src/services/StageProcessingService.ts`
   - 必要なら `packages/features/gis-sdk/src/vectorTiles.ts` に tile エンコード補助関数を追加する。

## Validation and Acceptance

- extract2 実行時に geojson-vt index 保存ログが出ること。
- vectortile 実行時に index 復元ログが出て、`[VectorTiles] index built` がタイルごとに出ないこと。
- Step5 でタイル生成が完了し、Step6 のプレビューが表示できること。
- 追加したコードで `pnpm typecheck` を実行し、型エラーがないこと。

## Idempotence and Recovery

Dexie のテーブル追加はバージョンを上げることで安全に実行できます。同じバージョン番号で再実行しても問題はありません。問題があれば該当差分を revert し、`clearStage('extract2')` によって保存済み index を削除してから再実行します。

## Artifacts and Notes

- `app/public/idb-geojson-vt-test.html` の検証コードを参照し、保存・復元・prototype 復帰の手順を踏襲する。
- vectortile 経路では per-tile index 生成を避けるため、tile タスクは新経路のみを使用する。

## Interfaces and Dependencies

- geojson-vt を使用し、index の保存は IndexedDB (Dexie) に行う。保存レコードは `GeojsonVtIndexRecord` として `EphemeralShapeDB` に追加する。
- `RuntimeWorkerVectorTileAdapter` からは `VectorTileWorkerAPI` に新しい保存メソッドを追加して呼び出す。保存対象は `Uint8Array` の MVT バイナリであり、nodeId/z/x/y を含める。
- `@maplibre/vt-pbf` は既存依存を再利用し、Tile の features を結合した `layer0` を生成する。

変更履歴: 2026-01-11 初版作成。2026-01-11 実装反映に合わせて進捗と判断ログを更新。
