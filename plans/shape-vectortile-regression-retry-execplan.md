# Shape vectortile regression retry loop for size overflow

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is located at `PLANS.md` from the repository root and this plan must be maintained in accordance with it.

## Purpose / Big Picture

この変更により、vectortile ステージで入力サイズ超過が発生した場合でも、自動的に簡略化を強めた再処理を行い、サイズ超過を減らすことができるようになる。ユーザーは Step5 のタスク一覧で size overflow による `regression` を確認でき、ビルドが簡略化の再試行を自動で実施する様子を観測できる。

## Progress

- [x] (2025-12-30 12:05 JST) ExecPlan を作成し、対象ファイルと方針を整理する。
- [x] (2025-12-30 14:20 JST) TaskStatus に regression を追加し、DB/Worker/UI の表示に反映する。
- [x] (2025-12-30 14:20 JST) vectortile サイズ超過時に regression + retry 更新を実装する。
- [x] (2025-12-30 14:25 JST) regression 検知で extract2 の再始動と vectortile 再実行を行う。
- [x] (2025-12-30 14:25 JST) extract2 の簡略化ロジックで retry 値に応じた強化を行う。
- [ ] (2025-12-30 11:50 JST) 検証手順を実施し、TASKS.md に結果を記録する。

## Surprises & Discoveries

（まだなし）

## Decision Log

- Decision: vectortile のサイズ超過は `regression` として扱い、retry < 2 なら extract2 を再実行して対処する。
  Rationale: vectortile の入力は extract2 出力に依存するため、再簡略化は extract2 まで戻るのが最も整合性が高い。
  Date/Author: 2025-12-30 / Codex

## Outcomes & Retrospective

（実装完了後に記載する）

## Context and Orientation

このリポジトリの shape plugin は Step5 でバッチ処理を実行する。`plugins/shape-plugin/src/services/batch/SessionController.ts` が download → extract1 → extract2 → vectortile の順でステージを制御し、各ステージのタスクは `shapeDB.batchTasks` に保存される。vectortile の処理は `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` が行い、サイズ超過時は `regression` として記録する。

ここでいう `regression` は「サイズ超過によって簡略化の再試行が必要な状態」を表すタスク状態であり、`failed` や `skipped` と区別して表示する。`retry` は再試行回数を表し、vectortile タスクの payload（inputData/config）に保存する。

## Plan of Work

まず TaskStatus を拡張する。`packages/features/shape-store/src/ShapeDB.ts` と `plugins/shape-plugin/src/common/types/batch.ts` の TaskStatus に `regression` を追加し、`packages/common/api/src/BatchControlAPI.ts` の `ProgressPhase` にも `regression` を追加する。UI 側で表示できるように `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressStep.tsx` のステータスラベル/色/集計に `regression` を加える。回帰中タスクは「完了していない」扱いにし、警告色で表示する。

次に vectortile のサイズ超過処理を修正する。`plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` のサイズ超過分岐で、payload の `retry` を読み取り、`retry` が undefined または 1 以下なら `regression` に設定し、payload の `retry` を `retry + 1` に更新する。`retry` が 2 以上なら `failed` にする。更新は `shapeDB.updateBatchTask` の `inputData` へ保存する。これにより再始動時に retry 値を参照できる。

次に SessionController を拡張する。`plugins/shape-plugin/src/services/batch/SessionController.ts` に regression 検知のユーティリティを追加し、vectortile ステージ完了後に `status === 'regression'` かつ `retry < 2` のタスクが 1 件以上ある場合、extract2 ステージを再実行して vectortile ステージへ戻るように制御を追加する。再始動時は extract2 タスクの payload に `retry` 値を渡せるようにし、初回は 0、再試行時は 1/2 を付与する。再試行は最大 2 回に制限し、無限ループを防ぐ。

最後に extract2 の簡略化ロジックを強化する。`plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` および `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` の extract2 実装で、payload の `retry` を参照し、`retry` がある場合は tolerance を増やし、quantize を小さくする（粗い簡略化にする）。具体的には `effectiveTolerance = tolerance * (1 + retry)`、`effectiveQuantize = max(1, round(quantize / (1 + retry)))` として適用する。これにより retry が進むほど簡略化が強くなる。

## Concrete Steps

1) TaskStatus と ProgressPhase に regression を追加し、UI で表示できるようにする。
   - 編集: `packages/common/api/src/BatchControlAPI.ts`
   - 編集: `packages/features/shape-store/src/ShapeDB.ts`
   - 編集: `plugins/shape-plugin/src/common/types/batch.ts`
   - 編集: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressStep.tsx`

2) vectortile サイズ超過時の regression + retry を実装する。
   - 編集: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`

3) regression 検知による extract2 再実行を追加する。
   - 編集: `plugins/shape-plugin/src/services/batch/SessionController.ts`

4) extract2 の retry 強化を実装する。
   - 編集: `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`
   - 編集: `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`

5) 必要なら TaskStatus の新値を集計/表示に追加する。
   - 編集: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressStep.tsx`

コマンドは repo ルートで以下を実行する。

  pnpm --filter @hierarchidb/shape-plugin typecheck

## Validation and Acceptance

受け入れ確認は Step5 の実データで以下を確認する。

- vectortile サイズ超過が発生したとき、タスクが `regression` と表示される。
- regression タスクが存在する場合、vectortile が終わった後に extract2 が再始動する（ログに extract2 再開の記録が出る）。
- retry が増えると、extract2 の簡略化パラメータが強化される（ログやデバッグ出力で `effectiveTolerance` の上昇を確認）。
- retry が 2 以上になったタスクは `failed` で終了し、無限に再試行されない。

## Idempotence and Recovery

この変更は繰り返し適用しても安全で、既存のタスクと DB を破壊しない。ロールバックは `plugins/shape-plugin/src/services/batch/**` と `packages/features/shape-store/src/ShapeDB.ts`、`plugins/shape-plugin/src/common/types/batch.ts` の差分を revert する。

## Artifacts and Notes

検証時に出力されたログは `TASKS.md` の運用ログに短く貼る。

## Interfaces and Dependencies

- `TaskStatus` と `ProgressPhase` に `regression` を追加する。
- `VectorTileTaskConfig` と extract2 の payload に `retry?: number` を追加する。
- vectortile サイズ超過の判定は `RuntimeWorkerVectorTileAdapter` に残し、状態遷移と retry 更新をそこで行う。

Plan revision note: Initial plan created to implement regression retry loop for vectortile size overflow.
Plan revision note (2025-12-30): Added ProgressPhase regression update in `packages/common/api/src/BatchControlAPI.ts` so task status typing matches the new regression state.
