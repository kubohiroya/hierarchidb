# Shape batch stages: per-stage WebWorker pool

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Shape の Step4 で指定した worker 数に応じて、download/extract1/extract2/vector tile の各ステージが実際に WebWorker を必要数だけ起動して並列処理するようにする。ユーザーは Step5 のビルド中に「ワーカー数を上げたら処理が並列化される」ことを体感できる。確認方法は、Step4 で worker 数を上げてビルドし、コンソールログとタスク進捗が従来より短時間で進むこと、および Worker の起動数が指定に追従することを観察する。

## Progress

- [x] (2025-12-29 00:04 JST) LRUSplitView の 0/0 表示を 0% に補正し、進捗の母数計算を完了+失敗+スキップに統一する方向で整理した。
- [x] (2025-12-29 00:09 JST) extract2 の入力バッファ欠落を extract1 失敗として扱う暫定対策を入れた。
- [x] (2025-12-29 01:25 JST) shape-plugin の専用 worker entry を追加し、download/extract の実処理を worker 側へ移した。
- [x] (2025-12-29 01:25 JST) shape-plugin の各ステージアダプタで WebWorker プールを生成し、Step4 の worker 数でタスクを分配するよう更新した。
- [ ] (2025-12-29 00:10 JST) Step5 の進捗が「登録数 = 完了+失敗+スキップ」で次ステージに移行することを検証し、結果を運用ログへ記載する。

## Surprises & Discoveries

- Observation: extract2 で `Extract2 input buffer not found` が発生するのは extract1 失敗タスクを extract2 が参照していたため。
  Evidence: ブラウザログで `Extract2 input buffer not found: <session>-extract1-<index>` が出る。

## Decision Log

- Decision: download/extract は shape-plugin 内の専用 WebWorker（新規 entry）を起動し、vectortile は既存の runtime-worker worker を複数起動して並列化する。
  Rationale: download/extract は `DataSourceStrategyFactory` など shape-plugin 依存が強く runtime-worker へ移せないため、プラグイン内 worker で完結させるほうが安全。vectortile は既存 worker を活かせる。
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

- (TBD) 実装完了後に、指定 worker 数での並列処理と進捗完了判定の整合をまとめる。

## Context and Orientation

この変更は shape-plugin のバッチ処理に関するもので、現在の処理は `plugins/shape-plugin/src/services/batch/SessionController.ts` が `download → extract1 → extract2 → vectortile` を順に実行している。download と extract は UI Worker 内で実行されており、vector tile は runtime-worker の `createStageWorkerClient()` で 1 Worker を起動している。Step4 の worker 数は UI で設定できるが、実際の WebWorker 起動数には反映されていない。

主な関連ファイルは次の通り。

- `plugins/shape-plugin/src/services/batch/SessionController.ts`: ステージ順序と進捗の集約。
- `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerDownloadAdapter.ts`: download の実処理。
- `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`: extract1/2 の実処理（現在は UI Worker 内）。
- `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`: vector tile の実処理（runtime-worker の Worker を 1 つ起動）。
- `packages/runtime-worker/src/services/StageProcessingService.ts`: stage worker の API 実装（download/extract/vectortile）。
- `packages/runtime-worker/src/services/RuntimeWorkerService.ts`: worker client レジストリ。
- `plugins/shape-plugin/src/services/utils/utils.ts`: Step4 の worker 数の既定とバリデーション。

ここでの「WebWorker」は `new Worker(new URL('...entry.js', import.meta.url), { type: 'module' })` で生成されるブラウザの worker を指す。runtime-worker の stage worker は Comlink を使って UI Worker 側から RPC 的に呼び出している。

## Plan of Work

最初に shape-plugin 内に download/extract 用の専用 worker entry を追加する。worker 側は `DataSourceStrategyFactory` と `LocalExtractAdapters.ts` 相当の処理を実行し、`shapeDB` と `EphemeralShapeDB` を直接更新する。API は「タスク1件を処理する」関数として公開し、main 側のアダプタが worker プールで並列実行する。

次に shape-plugin 側でステージごとに worker プールを作る。download/extract1/extract2 は新規の shape-plugin worker を `new Worker(new URL('...entry.ts', import.meta.url))` で worker 数分生成し、BatchService の並列タスク実行で round-robin で worker を選ぶ。vectortile は既存の runtime-worker の `createStageWorkerClient()` を worker 数分生成する。プールのライフサイクルは「ステージ開始時に生成・ステージ終了時に terminate」とし、進捗は「登録数 = 完了+失敗+スキップ」に合わせて計算する。

vector tile は metadataReplace を 1 回だけ行う必要があるため、最初の 1 タスク（または 1 worker）だけ metadataReplace=true を渡し、残りは false にする。Worker を複数起動しても metadataReplace が 1 回のみになるように、アダプタ側でフラグを管理する。

最後に SessionController の進捗集約と終了判定が「登録数 = 完了+失敗+スキップ」で次ステージへ移行することを確認し、Step5 の UI 表示が期待どおりになるかを確認する。TASKS 運用ログに変更内容・理由・ロールバック手順・検証結果を記録する。

## Concrete Steps

1) shape-plugin の専用 worker entry を追加し、download/extract 実処理を worker 側に移す。
   - 追加: `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.entry.ts`
   - 追加: `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`（Comlink で expose する API）
   - 実装の要点:
    - download: `DownloadTask` を受け取り、DataSourceStrategyFactory で取得→GeoJSON 変換→fgb 保存を行い、`EphemeralShapeDB` を更新する（`shapeDB.batchTasks` は main 側で更新）。
    - extract1/2: `Extract1Task` / `Extract2Task` を受け取り、`LocalExtractAdapters` と同等の処理を実行し、`EphemeralShapeDB` を更新する（`shapeDB.batchTasks` は main 側で更新）。
     - worker 側で `progress` は返り値で `processed/failed/skipped` を返し、アダプタ側で集計する。

2) shape-plugin のステージアダプタを worker プール対応にする。
   - 編集: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerDownloadAdapter.ts`（shape worker プールへ置換）
   - 追加: `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerPool.ts`（worker 生成/terminate）
   - 編集: `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` を置換 or 新規 `RuntimeWorkerExtract1Adapter` / `RuntimeWorkerExtract2Adapter` を追加
   - 編集: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`（runtime-worker worker を worker 数分生成）
   - 実装の要点:
     - `createStageWorkerClient()` を worker 数分生成し、`BatchService.mapChunks` 内で worker を選択して処理する。
     - 終了時に全 worker を terminate する。
     - 進捗は登録タスク数を total とし、完了+失敗+スキップで percentage を算出する。

3) SessionController で Step4 の worker 数を各ステージに渡す。
   - 編集: `plugins/shape-plugin/src/services/batch/SessionController.ts`
   - 実装の要点: download は `downloadConfig.maxConcurrent`、extract1/2 は `extract1Config.workers`/`extract2Config.workers`、tile は `tileConfig.workers` を `StageControls.maxConcurrent` として渡す。

4) 進捗と UI の動作確認。
   - 手順: Step4 で worker 数を 1 → 4 などに変え、ビルドを開始して進捗が短時間化するか、`console` に worker 起動数が出るかを確認する。

## Validation and Acceptance

- Step4 で worker 数を 4 に設定してビルドすると、download/extract/vector tile が 4 worker で並列実行される。
- Step5 の進捗が「登録数 = 完了+失敗+スキップ」で 100% になり、次ステージへ進む。
- vector tile のメタデータは 1 回だけ replace され、重複削除が起きない。

## Idempotence and Recovery

- Worker 起動数の変更は実行時のみで、再実行しても DB を破壊しない。
- ロールバックは、今回編集したファイルの差分を revert し、結果を GitHub Issue に追記する。

## Artifacts and Notes

- 期待ログ例:
    [Session <id>] Processing download stage
    [ShapeBuildStep] batchTasks:ok { count: ... }
    [Session <id>] Extract1 stage completed: X/Y successful

## Interfaces and Dependencies

- `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` が download/extract の処理を担う。
- `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.entry.ts` が Comlink エンドポイントを公開する。
- `plugins/shape-plugin/src/services/batch/adapters/*` が worker プールを管理する。
- `@hierarchidb/batch` の `BatchService.mapChunks` を利用して並列数を制御する。

Plan revision note: download/extract の worker 実装を runtime-worker ではなく shape-plugin 専用 worker に変更する決定を追記し、手順を更新した。
