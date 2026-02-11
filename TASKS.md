2684) fix/shape/task-status-prevent-completed-to-running-regression (P1) — 完了 (2026-02-10)
- ブランチ名: ERIA-Cartograph
- 依存: なし
- 受け入れ基準: Shapeプラグインのタスク一覧で個別タスクが `Completed` 表示後に `Running` へ逆戻りしない／既存の task update/snapshot マージ挙動を壊さない／影響範囲の検証結果を TASKS.md に記録する／原因・発生範囲・修正方法と適用範囲を TASKS.md に記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync.ts`
- ロールバック手順: 上記ファイル差分を revert し、従来の task status マージロジックへ戻す
- チェックリスト:
  - `Completed` 到達済みタスクの最新スナップショット/更新イベント取り込み時に `Running` へ戻さない
  - task delete / reset 時に completed キャッシュも同期削除する
  - 影響範囲の test/typecheck/build を実行し結果を記録する
  - 運用ログ start/update/done/blocked を追記する
- 運用ログ:
  - start: 2026-02-10 21:50 JST Shapeプラグイン task list で `Completed -> Running` 逆遷移を防止する修正に着手。
  - update: 2026-02-10 21:52 JST 原因は `useShapeBuildTaskSync.ts` の `resolveTaskSummary` が受信イベントをそのまま正規化し、既に完了確定した taskId でも後続の遅延 `running` update/snapshot を採用し得たこと。発生範囲は同ファイルの task 正規化〜マージ経路（`resolveTaskSummary` / `mergeTask` / `handleSnapshot`）。
  - update: 2026-02-10 21:53 JST 修正として `completedTasksRef` を追加し、taskId 単位で completed 到達済みタスクを保持。`resolveTaskSummary` で後続 `running` を受信しても completed キャッシュを優先返却するよう変更。加えて `mergeTask`/`handleSnapshot` で completed キャッシュを更新し、`handleDelete`/`syncTasksRef` でも整合を維持。適用範囲は `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync.ts` のみ。
  - blocked: 2026-02-10 21:55 JST `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` は corepack 経由 pnpm 取得時に `ENETUNREACH` で失敗（registry 到達不可）。
  - blocked: 2026-02-10 21:55 JST `node_modules/.bin/turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` も内部 `pnpm run build` 呼び出しで同じ `ENETUNREACH` により失敗。
  - blocked: 2026-02-10 21:55 JST 代替として `node_modules/.bin/vitest run plugins/shape-plugin/src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` を実行したが、依存パッケージ alias 解決（`@hierarchidb/util`）が未ビルドで import 解決失敗。
  - done: 2026-02-10 21:56 JST ネットワーク制限で turbo/pnpm ベース検証は完走不可。コード修正は完了し、検証未完了理由と代替実行結果を記録。

# TASKS Hub

このファイルは運用ハブです。詳細タスクは GitHub Issues / Project で管理します。

## 運用方針（2026-02-10 以降）

- 旧 `TASKS.md` は `TASKS.obsolete.2026-02-10.md` に凍結アーカイブ済み（参照専用）。
- 新規タスクは 1 Issue = 1 タスクで作成する。
- 本ファイルには `Doing` / `Blocked` / `今日の運用ログ` だけを記録する。
- 受け入れ基準（DoD）・依存・ロールバック手順・検証ログは Issue 側に記録する。

## Git ブランチ戦略

- 命名: `<type>/<scope>/<slug>`
- マージ: 基本 `Squash and Merge`
- PR は必ず Issue を紐付ける（`Refs #<issue-number>`）

## Kanban

### Doing

- なし

### Blocked

- なし

### ToDo（優先順）

1. `chore/tasks/bootstrap-github-project-fields`
- 依存: なし
- 受け入れ基準: Project に `Status / Priority / Area / DoD / Rollback / Due` フィールドが作成され、Issue から更新可能。

2. `chore/tasks/migrate-active-items-from-obsolete-archive`
- 依存: `chore/tasks/bootstrap-github-project-fields`
- 受け入れ基準: 直近 14 日の `進行中` タスクを Issue 化し、`TASKS.obsolete.2026-02-10.md` の参照位置を Issue 本文へ記録。

### Done

1. `chore/tasks/archive-legacy-tasks-md-and-introduce-scalable-workflow` — 完了 (2026-02-10)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - 旧巨大 `TASKS.md` が日付付きファイルへ移動され、参照専用ヘッダが付与される。
  - 新 `TASKS.md` が軽量ハブへ置換される。
  - スケーラブル運用（Issue/Project）を `docs/task-management.md` で定義する。
- ロールバック手順:
  - `TASKS.obsolete.2026-02-10.md` を `TASKS.md` に戻し、新規追加ファイルを revert。
- 検証:
  - `ls TASKS*.md` で `TASKS.md` と `TASKS.obsolete.2026-02-10.md` の共存を確認。
  - `head -n 8 TASKS.obsolete.2026-02-10.md` で Obsolete ヘッダを確認。

2. `fix/shape/transform-progress-message-finalization` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - Transform タスクで `Running` 中に `progress=100` の phase メッセージ通知を出さない
  - `Completed` 到達時のみ `progress=100` で最終メッセージが確定する
  - 既存の task queue / progress 購読処理を壊さない
- 影響範囲:
  - `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
- ロールバック手順:
  - 上記ファイルの `normalizePhaseProgress` 変更を revert して、phase 進捗 100% 許容の旧挙動へ戻す
- 検証:
  - `pnpm -w turbo run typecheck --filter @hierarchidb/vt-orchestrator` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/vt-orchestrator` (exit 0)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` (exit 0)

3. `fix/shape/task-status-ignore-running-after-completed100` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - 同一 taskId で `Completed(100%)` 到達後に遅延 `Running/Queued` 更新が来ても表示を逆戻りさせない
  - `Queued -> Running -> Completed` の通常遷移と completed message 昇格を壊さない
  - 回帰テストで `100% Completed -> 97% Running` を再現して抑止できる
- 原因:
  - `useShapeBuildTaskSync.ts` のマージ規則が completed 逆戻りを部分的に抑止していたが、terminal 条件が明示されておらず `Completed(100%)` の後続非終端イベントを一律拒否する保証が弱かった
- 発生範囲の確認:
  - `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync.ts` の `resolveTaskSummary` / `shouldPreferNextTask` / `mergeTask` / `handleSnapshot` / `syncTasksRef`
  - `plugins/shape-plugin/src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` のイベント順序ケース
- 修正方法と適用範囲:
  - `Completed(100%)` を terminal として固定し、同一 taskId の後続 `Running/Queued` および `100% 未満 Completed` を無視するガードを追加
  - task 比較規則を `isCompletedAtFullProgress` 優先へ再編し、terminal からの逆遷移を拒否
  - 適用範囲は上記 2 ファイルのみ
- ロールバック手順:
  - 上記 2 ファイルの差分を revert して従来のマージ/正規化ロジックへ戻す
- 検証:
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` (exit 0, 1 file / 8 tests passed)

4. `fix/shape/reduce-transform-vt-boundary-memory` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - Transform→VT 境界で `buildVtTasks` がタイルごとに `transformCache.anyOf(...).toArray()` を繰り返さない
  - VTタスク生成に必要な `featureCount` を relation 側の軽量メタデータから算出できる
  - 既存の relation 復旧（backfill）経路と互換性を維持する
- 原因:
  - `plugins/shape-plugin/src/services/vt/shapePipelineShared.ts` の `buildVtTasks` が、タイルごとに重い `transformCache` レコード（`data: ArrayBuffer` を含む）を反復読み込みしていた
- 発生範囲の確認:
  - `plugins/shape-plugin/src/services/vt/shapePipelineShared.ts` の `buildVtTasks` / `backfillTileRelationsFromTransformCache`
  - `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` の relation 永続化経路
- 修正方法と適用範囲:
  - relation レコードへ `featureCount` / `cacheTimestamp` を保持し、VTタスク生成時は relation 集計のみで `featureCount` を計算
  - relation 欠損時の backfill でも同メタデータを再構築して保存
  - 適用範囲は `plugins/shape-plugin/src/services/vt/shapePipelineShared.ts`、`packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`、型定義2ファイル（`packages/gis-sdk/src/ephemeral/EphemeralBuildState.ts`、`packages/shape-api/src/shapeDbTypes.ts`）
- ロールバック手順:
  - 上記4ファイルの差分を revert し、VTタスク生成時に `transformCache` 参照で `featureCount` を計算する従来ロジックへ戻す
- 検証:
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/common/__tests__/unit/taskTitles.unit.test.ts` (exit 0, 1 file / 2 tests passed)

5. `fix/shape/reduce-build-progress-log-noise` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - `ShapeBuildProgressStep` の progress 連打ログ（`worker progress update`）を停止する
  - `Completed` 到達後に同一 task の stale `Running/Queued` が来たときだけ警告ログを出す
  - 進捗ログは終端更新（`taskStatus=completed` または非 phase の `percentage>=100`）のみに絞る
- 原因:
  - `useShapeBuildStep.ts` が `effectiveProgress.message` 更新ごとに info ログを出力しており、`phase=...` の大量通知が調査ノイズを増やしていた
- 発生範囲の確認:
  - `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts` の progress ログ出力 effect（`emitBuildSessionTransitionLog` 呼び出し）
- 修正方法と適用範囲:
  - progress ログの dedupe key を `progressTerminalLogKeyRef` / `staleProgressLogKeyRef` に分離
  - completed 到達済み task への stale `running/queued` は早期 return し、`ignored stale worker progress update after completion` を warn で 1 回のみ出力
  - 通常ログは `worker progress terminal update`（終端更新のみ）へ限定
  - 適用範囲は `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts` のみ
- ロールバック手順:
  - 上記ファイルの差分を revert し、従来の progress message ごとの info ログ出力へ戻す
- 検証:
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildStep.unit.test.tsx` (exit 1, `ERR_WORKER_OUT_OF_MEMORY`)
  - `NODE_OPTIONS='--max-old-space-size=8192' pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildStep.unit.test.tsx` (exit 1, `ERR_WORKER_OUT_OF_MEMORY`)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildStep.unit.test.tsx --pool forks --poolOptions.forks.singleFork=true` (exit 1, OOM)
  - `NODE_OPTIONS='--max-old-space-size=8192' pnpm -w turbo run test --concurrency=1 --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildStep.unit.test.tsx --pool forks --poolOptions.forks.singleFork=true --maxWorkers=1` (exit 1, OOM)

6. `fix/shape/task-subscribe-gap-resync-and-reset-event-consistency` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - `subscribeToTasks` が sequence 欠番を検知したら即時 snapshot 再同期する（定期 snapshot は導入しない）
  - queue clear / running reset / failed reset が購読者へ確実に反映される（直接 DB 書き換えを避ける）
  - shape-plugin の typecheck/build が成功する
- 原因:
  - reset/clear の一部が Dexie 直接操作で実装され、task update/delete イベントが購読側へ流れず、UI 状態が取り残される可能性があった
  - `subscribeToTasks` は単純な sequence 単調性フィルタのみで、欠番発生時の自己修復（snapshot 再同期）がなかった
- 発生範囲の確認:
  - `plugins/shape-plugin/src/worker/api.ts` の `clearTaskQueueStages` / `resetRunningTasks` / `resetFailedTasks` / `subscribeToTasks`
- 修正方法と適用範囲:
  - `clearTaskQueueStages` を `listTasksByStage` + `deleteTasksByIds` ベースへ変更して delete イベント整合を確保
  - `resetRunningTasks` / `resetFailedTasks` を `listTasksByStatus` + `updateTask` ベースへ変更して update イベント整合を確保
  - `subscribeToTasks` に sequence gap 検知 (`nextSequence > current+1`) を追加し、検知時は即時 `sendSnapshot()` で再同期（定期 snapshot なし）
  - 適用範囲は `plugins/shape-plugin/src/worker/api.ts` のみ
- ロールバック手順:
  - 上記ファイルの差分を revert し、従来の direct DB 更新 + gap 無検知ロジックへ戻す
- 検証:
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)

7. `fix/shape/fetch-vt-pending-task-finalization-on-stage-abort` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: 6
- 受け入れ基準:
  - Fetch/VT ステージで例外発生時に `queued/running` の pending task が残存しない
  - pending task は `failed` へ遷移し、`aborted: ...` メッセージが記録される
  - shape-plugin の test/typecheck/build が成功する
- 原因:
  - Transform には例外時 pending 畳み込みがあった一方で、Fetch/VT はステージ例外時に pending を terminal へ収束させる処理が不足していた
- 発生範囲の確認:
  - `plugins/shape-plugin/src/services/vt/shapePipelineFetchStage.ts`
  - `plugins/shape-plugin/src/services/vt/shapePipelineVtStage.ts`
- 修正方法と適用範囲:
  - Fetch/VT 両ステージの `runStageTasks/runShapeFetchStage` 呼び出しを `try/catch` 化し、`catch` で `finalizePendingStageTasks(..., 'aborted: ...')` を実行して pending を `failed` へ畳み込み
  - 回帰テスト `shapePipelineFetchStageSection.unit.test.ts` を追加し、ステージ例外時に `running/queued=0`・`failed=1`・`message/errorMessage` 整合を検証
  - 適用範囲は上記2実装ファイルと新規テスト1ファイル
- ロールバック手順:
  - 上記 3 ファイルの差分を revert し、従来の例外伝播のみ（pending 未畳み込み）へ戻す
- 検証:
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/__tests__/unit/shapePipelineFetchStageSection.unit.test.ts` (exit 0, 1 file / 1 test passed)
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)

8. `fix/shape/fetch-skip-message-show-reduction-details` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: 7
- 受け入れ基準:
  - Fetch ステージで `no features after fetch filter` の skip 時に固定文言ではなく件数差分（features/polygons/vertices）を表示する
  - 既存の completed ステータス遷移を壊さない
  - shape-plugin の test/typecheck/build が成功する
- 原因:
  - Fetch フィルタで全件除外されたケースの completed message が固定文字列で、実際の除外理由（件数減少）が UI から読めなかった
- 発生範囲の確認:
  - `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts` の `filteredCollection.features.length === 0` 分岐（topojson/通常系の2経路）
- 修正方法と適用範囲:
  - `buildFetchFilterReductionSummary` を追加し、`features/polygons/vertices` の `input -> 0` 差分メッセージを生成
  - 全件除外分岐の completed message を同ヘルパー利用へ変更
  - 単体テスト `shapeFetchStage.unit.test.ts` を追加し、差分メッセージを回帰検証
  - 適用範囲は `shapeFetchStage.ts` と `shapeFetchStage.unit.test.ts` のみ
- ロールバック手順:
  - 上記2ファイルの差分を revert し、従来の固定 skip 文言へ戻す
- 検証:
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/__tests__/unit/shapeFetchStage.unit.test.ts` (exit 0, 1 file / 1 test passed)
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)

9. `fix/shape/reset-session-skeleton-and-completed-count-reset` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - Reset Session 押下直後に、ステージごとのサマリーおよびタスク一覧を Skeleton 表示へ切り替える
  - Reset 完了後に `Completed` 件数が残留せず、確実に 0 へ収束する
  - shape-plugin の関連 typecheck/build/test が成功する
- 原因:
  - Reset は非同期削除完了待ちのため、押下直後は旧サマリー/旧タスク表示が残り UX 上の待機状態が不明瞭だった
  - サマリー集計で `idle + task empty` 時に planned count を fallback 採用する経路があり、`Completed` 数が stale 表示で残り得た
- 発生範囲の確認:
  - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel.tsx`
  - `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildProgressSummary.ts`
  - `packages/components/src/BuildStepPanel.tsx`
  - `packages/components/src/BuildStepStagePanel.tsx`
- 修正方法と適用範囲:
  - `ShapeBuildProgressPanel.tsx` に reset ローカル pending を追加し、押下直後に stage ごとの loading state と display 用 0 サマリー/空タスクへ切り替え
  - `BuildStepPanel.tsx` / `BuildStepStagePanel.tsx` に stage 単位 `loading` 連携を追加し、サマリー領域を Skeleton 描画
  - `useShapeBuildProgressSummary.ts` で `idle + total=0` 時は planned fallback を無効化し、stage/overall progress を 0 固定化
  - 適用範囲は上記4ファイルのみ
- ロールバック手順:
  - 上記 4 ファイルの差分を revert し、Reset 中の通常描画と既存サマリー fallback ロジックへ戻す
- 検証:
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` (exit 0, 1 file / 3 tests passed)

10. `fix/shape/start-resume-console-trace` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - Start/Resume 押下直後に、クリック受領・pending遷移・start handler待機を `console.log` で追跡できる
  - Start/Resume 実行本体で主要 await（lock/draft/worker/session/persist）の開始・終了・失敗と経過msを `console.log` で追跡できる
  - shape-plugin の typecheck/build/test が成功する
- 原因:
  - 既存ログは `useShapeBuildStep` 側の startup step ログ中心で、UI側（ボタン押下〜handler呼び出し）の待機区間に可視性が低かった
  - そのため Start/Resume 押下直後に loading/disabled のまま滞留した際、どの層で待機しているか判別しづらかった
- 発生範囲の確認:
  - `plugins/shape-plugin/src/ui/components/build-progress/useBuildProgressPanelState.ts`
  - `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts`
- 修正方法と適用範囲:
  - `useBuildProgressPanelState.ts` に `[ShapeBuildStartResumeTrace]` ログを追加し、`handleStartClick` / `handleConfirmStart` / `runStartOrResume` の開始・分岐・完了・失敗・3秒ごとの待機ハートビートを出力
  - `useShapeBuildStep.ts` の `handleStartOrResume` に timed step ラッパーを追加し、主要 await 境界（lock acquire/wait, draft save, worker initialize, session start/resume, status persist）の start/finish/error を elapsed 付きで出力
  - 適用範囲は上記2ファイルのみ
- ロールバック手順:
  - 上記 2 ファイルの差分を revert し、従来の startup step ログのみの挙動へ戻す
- 検証:
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` (exit 0, 1 file / 3 tests passed)

11. `fix/shape/transform-cache-reset-and-startup-pending-snackbar` — 完了 (2026-02-11)
- ブランチ名: `ERIA-Cartograph`
- 依存: なし
- 受け入れ基準:
  - Transform キャッシュ削除後に `Completed x/y` が残留せず、セッション表示が 0 件へ収束する
  - Start/Resume 押下後（タスク開始前）の待機中に、進捗文言を Snackbar で表示できる
  - デバッグ時の待機 Snackbar は自動消去せず、ユーザー手動 dismiss のみで閉じる
  - shape-plugin の typecheck/build/test が成功する
- 原因:
  - `handleDeleteTransformCache` は transform/vt task を削除しても session status をリセットせず、`Completed` 集計表示が残留し得た
  - Start/Resume の初期化待機区間で UI 通知がなく、ユーザーには loading/disabled の待機理由が見えなかった
- 発生範囲の確認:
  - `plugins/shape-plugin/src/ui/components/build-config/useShapeBuildCacheActions.ts`
  - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel.tsx`
  - `plugins/shape-plugin/src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx`
- 修正方法と適用範囲:
  - `handleDeleteTransformCache` で stale reset に該当しない場合でも `onResetSession` + `persistSessionReset` を実行し、セッション表示値を確実に初期化
  - `ShapeBuildProgressPanel.tsx` に startup pending Snackbar を追加し、`controls.startPending` かつ build 未開始/未終端時に `statusLabel` を表示、手動 dismiss 対応
  - panel unit test に startup pending Snackbar の表示と手動 close ケースを追加
  - 適用範囲は上記3ファイルのみ
- ロールバック手順:
  - 上記 3 ファイルの差分を revert し、transform 削除時の従来セッション保持と startup snackbar 非表示へ戻す
- 検証:
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` (exit 0)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` (exit 0, 1 file / 5 tests passed)

## 今日は着手（運用ログ）

- start: 2026-02-11 07:31 JST 旧 `TASKS.md` 長大化のため、日付付き Obsolete アーカイブ化と新運用ハブへの移行に着手。
- done: 2026-02-11 07:39 JST `TASKS.obsolete.2026-02-10.md` へ凍結アーカイブし、新 `TASKS.md` と `docs/task-management.md` / `docs/templates/task-issue-template.md` を作成。
- start: 2026-02-11 07:42 JST Shape Step5 Transform の進捗通知を再編し、`100% Completed` メッセージ上書き揺れを防ぐ修正に着手。
- update: 2026-02-11 07:47 JST 原因は Transform ハンドラが `running` 状態の phase 更新でも `progress=100` を通知しうる実装（`encode:done` / `cache:put:start`）で、最終 `completed` メッセージと同じ 100% 帯で複数 message が競合していたこと。発生範囲は `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` の `updateTaskPhase` 経路。
- update: 2026-02-11 07:48 JST 修正として `normalizePhaseProgress` の戻り値を最大 `99` に制限し、`100` は `completed` 更新（`finalizeTaskWithCache` および completed return）でのみ到達するよう再編。適用範囲は同ファイルのみ。
- done: 2026-02-11 07:49 JST `vt-orchestrator` の typecheck/build と shape-plugin の関連ユニットテストを実行し、すべて exit 0 を確認。
- start: 2026-02-11 07:45 JST 新タスク管理方針（Issue/Project主導 + `TASKS.md` ハブ）を `AGENTS.md` へ明記する移行作業に着手。
- done: 2026-02-11 07:49 JST `AGENTS.md` を新方針へ更新し、旧 `TASKS.md` 単一SSOT 記述を Issue/Project 主体へ移行。
- start: 2026-02-11 08:35 JST Shape Step5 の 97-100% 帯で `100% Completed -> 97% Running` に逆戻りする再発を調査し、`Completed(100%)` 後の `Running/Queued` を無視する対策に着手。
- update: 2026-02-11 08:37 JST 原因は `useShapeBuildTaskSync.ts` の task マージ規則で `Completed(100%)` を terminal として固定する条件が明示されておらず、後続の非終端 update/snapshot を抑止する保証が弱かったこと。発生範囲は同ファイルの `resolveTaskSummary` / `shouldPreferNextTask` / `mergeTask` / `handleSnapshot` / `syncTasksRef`。
- update: 2026-02-11 08:38 JST 修正として `Completed(100%)` を terminal に定義し、同一 taskId の後続 `Running/Queued` および `100% 未満 Completed` を無視するガードを追加。あわせて `shouldPreferNextTask` を terminal 優先に再編し、適用範囲は `useShapeBuildTaskSync.ts` と `useShapeBuildTasks.unit.test.tsx` のみ。
- done: 2026-02-11 08:39 JST `shape-plugin` の typecheck/build/対象ユニットテスト（8 tests）を Turbo 経由で実行し、すべて exit 0 を確認。
- start: 2026-02-11 08:38 JST Transform→VT ステージ境界のメモリ負荷削減タスクに着手。`buildVtTasks` の `transformCache` 反復読み込み経路を調査開始。
- update: 2026-02-11 08:42 JST 原因は `buildVtTasks` がタイルごとに `transformCache.anyOf(...).toArray()` を実行し、同一 `bufferId` の重いレコードを繰り返しメモリへ展開していたこと。発生範囲は `shapePipelineShared.ts` の VTタスク生成と、relation metadata 永続化経路。
- update: 2026-02-11 08:42 JST 修正として `tileIdToBufferRelations` に `featureCount/cacheTimestamp` を保存し、VTタスク生成では relation 集計のみで `featureCount` を算出する方式へ変更。欠損relation復旧（backfill）でも同メタデータを書き戻すようにした。適用範囲は `shapePipelineShared.ts`、`createTransformByBandHandler.ts`、型定義2ファイル。
- done: 2026-02-11 08:42 JST `shape-plugin` の build/typecheck/対象ユニットテストを Turbo 経由で実行し、すべて exit 0 を確認。
- start: 2026-02-11 08:50 JST Shape Step5 調査のため `ShapeBuildProgressStep` の冗長 progress ログ削減タスクに着手。
- update: 2026-02-11 08:55 JST 原因は `useShapeBuildStep.ts` が progress メッセージごとに `worker progress update` を出力していたこと。発生範囲は同ファイルの progress ログ effect。
- update: 2026-02-11 08:56 JST 修正として stale running/queued の警告ログ化と、終端更新のみの info ログへ再編。適用範囲は `useShapeBuildStep.ts` のみ。
- done: 2026-02-11 09:03 JST `shape-plugin` の typecheck/build は Turbo 経由で exit 0 を確認。
- blocked: 2026-02-11 09:03 JST `useShapeBuildStep.unit.test.tsx` は Turbo 経由で複数条件（`NODE_OPTIONS` 拡張、`--pool forks`、`--concurrency=1`）を試しても `ERR_WORKER_OUT_OF_MEMORY` / heap OOM により完走不可。
- start: 2026-02-11 09:20 JST Fetch/VT を含むタスク残存問題の根本対処として task 購読欠番再同期と reset/clear イベント整合化の実装に着手。
- update: 2026-02-11 09:24 JST 原因は `api.ts` 内の direct DB 更新経路（delete/modify）が購読イベントを発火せず UI 取り残しを生み得る点と、`subscribeToTasks` が sequence 欠番を自己修復しない点。発生範囲は `clearTaskQueueStages` / `resetRunningTasks` / `resetFailedTasks` / `subscribeToTasks`。
- update: 2026-02-11 09:29 JST 修正として clear/reset を `vt-orchestrator` API (`deleteTasksByIds` / `updateTask`) 経由へ統一し、`subscribeToTasks` へ gap 検知時即 snapshot 再送（初回 snapshot あり、定期 snapshot なし）を追加。適用範囲は `plugins/shape-plugin/src/worker/api.ts`。
- done: 2026-02-11 09:34 JST `shape-plugin` の typecheck/build を実行し exit 0 を確認。実装・検証結果を Done/運用ログへ記録完了。
- start: 2026-02-11 09:45 JST `Fetch`/`VT` の `Running + message空欄` 残留（低頻度）に対する追加調査と stage 例外時 pending 畳み込み対策に着手。
- update: 2026-02-11 09:49 JST 原因は `shapePipelineFetchStage.ts` / `shapePipelineVtStage.ts` がステージ例外時に pending task (`queued/running`) を terminal へ収束させず、状態残留が起き得たこと。発生範囲は両ファイルの stage 実行ラッパー。
- update: 2026-02-11 09:53 JST 修正として両ステージを `try/catch` 化し、`catch` で `finalizePendingStageTasks(..., 'aborted: ...')` を実行。加えて fetch ステージ例外時の pending 畳み込みを検証する unit test を追加。適用範囲は `shapePipelineFetchStage.ts` / `shapePipelineVtStage.ts` / `shapePipelineFetchStageSection.unit.test.ts`。
- done: 2026-02-11 09:57 JST 追加テスト・typecheck・build（Turbo 経由）を実行し、すべて exit 0 を確認。
- start: 2026-02-11 09:58 JST Fetch ステージ skip 理由の表示改善（固定文言から件数差分へ）に着手。
- update: 2026-02-11 10:02 JST 原因は `shapeFetchStage.ts` の全件除外分岐が `skipped: no features after fetch filter` を返しており、発生範囲は topojson/通常系の2分岐。件数差分表示ヘルパーを導入して両分岐へ適用。
- done: 2026-02-11 10:07 JST 追加ユニットテスト（`shapeFetchStage.unit.test.ts`）のDB不整合を修正後、test/typecheck/build（Turbo 経由）をすべて exit 0 で確認。
- start: 2026-02-11 10:08 JST Progress `scope` の UI 推定（title/metadata/inputData/selected countries 由来）を撤去し、worker 通知ベースへ統一する修正に着手。
- update: 2026-02-11 10:09 JST 原因は `useShapeBuildStep.ts` の `progressScope` が `displayTasks` と選択国から推定される設計で、`progressTaskId` と無関係な scope がログに混在し得たこと。発生範囲は `useShapeBuildStep.ts` と `useShapeBuildTaskSync.ts` の scope 推定処理。
- done: 2026-02-11 10:10 JST `progressTaskTitle` を worker→UI で伝搬し、ログは `taskId/taskTitle`（scope は taskId からのみ導出）へ統一。`pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` をすべて exit 0 で確認。
- start: 2026-02-11 10:12 JST Resume 実行時に `fetch` ステージ elapsed が 0 化される問題の調査・修正に着手。
- update: 2026-02-11 10:14 JST 原因は `useShapeBuildStep.ts` の `stageElapsedByStage` / `stageTimingByStage` 永続化 effect が、再開直後の未同期 state（空 map）を先に保存し、既存 persisted 値を上書きし得ること。発生範囲は `useShapeBuildStep.ts` の `persistDraftPatch({ stageElapsedByStage ... })` / `persistDraftPatch({ stageTimingByStage ... })` 直前ガード。
- update: 2026-02-11 10:18 JST 修正として両 effect の永続化前に persisted 値との merge を強制し、state が不足している間は setState で復元して保存をスキップするガードを追加。適用範囲は `useShapeBuildStep.ts` のみ。
- done: 2026-02-11 10:26 JST `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` を実行し、ともに exit 0 を確認。
- start: 2026-02-11 11:03 JST 経過時間タイマーを「停止」または「アクティブ1ステージのみ毎秒+1秒」に限定する修正に着手。
- update: 2026-02-11 11:03 JST 原因は `useShapeBuildStep.ts` の stage timer が 300ms 間隔で経過分をまとめ加算する catch-up 実装（`Math.floor((now-last)/1000)*1000`）で、UI負荷時に大きなジャンプを許容していたこと。発生範囲は同ファイルの `displayStageElapsedMs` 更新 effect と stage 切替 snapshot 記録。
- update: 2026-02-11 11:03 JST 修正として running 中は 1000ms interval で固定 `+1000ms` のみ加算し、停止中は加算停止に変更。あわせて stage 切替時に保持する snapshot を running 中は `displayStageElapsedMs` ベースへ統一し、総経過時間が単一ステージの tick に追従するよう調整。適用範囲は `useShapeBuildStep.ts` のみ。
- done: 2026-02-11 11:03 JST `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` を実行し、ともに exit 0 を確認。
- start: 2026-02-11 11:20 JST 経過時間ロジックを「アクティブステージのみ毎秒+1秒」に完全統一し、`stageTimingByStage` 依存撤去に着手。
- update: 2026-02-11 11:20 JST 原因は `useShapeBuildStep.ts` / `ShapeBuildProgressPanel.tsx` が `stageElapsedByStage` と `stageTimingByStage` を併用しており、表示ソースが複線化して不一致・リセットが再発し得たこと。発生範囲は elapsed 集計/表示と reset patch 群。
- update: 2026-02-11 11:20 JST 修正として elapsed の唯一ソースを `stageElapsedByStage`（state: `completedStageElapsedMs`）へ統一し、running 中は active stage のみ 1000ms interval で加算、total は stage 合計で算出。`stageTimingByStage` の読み書き・fallback を `useShapeBuildStep.ts` / `ShapeBuildProgressPanel.tsx` / reset patch 実装（`ShapeBuildConfigStep.tsx`、`useShapeBuildCacheActions.ts`、`useShapeCountrySelectionStep.ts`）から撤去。
- done: 2026-02-11 11:20 JST `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` を再実行し、ともに exit 0 を確認。
- start: 2026-02-11 13:35 JST 「毎秒加算条件」を CircularProgress の indeterminate 条件（runningタスク実在）へ一致させる修正に着手。
- update: 2026-02-11 13:35 JST 原因は `useShapeBuildStep.ts` が `buildStatus === 'running' && timingStageId` だけで加算しており、stage に running タスクが無い（queued待ち等）区間も elapsed が進み得たこと。発生範囲は同ファイルの elapsed interval effect。
- update: 2026-02-11 13:35 JST 修正として `isTimingStageRunning`（`timingStageId` の stage に `status==='running'` が存在）を導入し、interval 条件を `buildStatus === 'running' && isTimingStageRunning` に変更。active stage 判定は現状維持。
- done: 2026-02-11 13:35 JST `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` を実行し、ともに exit 0 を確認。
- start: 2026-02-11 11:24 JST Start/Resume 押下後の loading/disabled ラグ解消タスクの仕上げ（即時 pending 反映 + 回帰テスト）に着手。
- update: 2026-02-11 11:26 JST 原因は `useBuildProgressPanelState.ts` で start pending が atom 更新経由のみだったため、クリック直後の描画反映が遅れ得る点。発生範囲は `plugins/shape-plugin/src/ui/components/build-progress/useBuildProgressPanelState.ts` と `ShapeBuildProgressPanel.unit.test.tsx`。
- update: 2026-02-11 11:27 JST 修正として `flushSync` を使うローカル pending (`localStartPending`) を導入し、`controls.startPending` と OR 合成して即時 disabled を保証。テスト側は `BuildSessionLauncherPanel` をモック化し、`SessionCoordinatorProvider` 必須化による非本質依存を分離。適用範囲は上記2ファイルのみ。
- done: 2026-02-11 11:27 JST `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` を実行し、最終的にすべて exit 0 を確認（テスト初回失敗: `useSessionCoordinator must be used within SessionCoordinatorProvider` はモック化で解消）。
- done: 2026-02-11 11:28 JST モック追加後の最終確認として `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` を再実行し、いずれも exit 0 を確認。
- start: 2026-02-11 11:52 JST `@deprecated` かつ未配線ファイルの棚卸し・削除タスクに着手。`rg` で候補抽出後、import/export/registry 経路を確認して削除対象を確定する。
- update: 2026-02-11 12:02 JST 原因は互換維持のため残していた deprecated API ファイル（`app/src/plugin-loaders/auto-load.ts` / `plugins/shape-plugin/src/ui/components/build-progress/executePauseBuildFlow.ts` / `PluginRegistryAPI.ts`）が実コード導線（import/export/registry）から切り離され、未配線のまま残存していたこと。発生範囲は当該 3 ファイルと `knip.json` の root entry（`PluginRegistryAPI.ts`）のみ。
- blocked: 2026-02-11 12:03 JST `pnpm -w turbo run typecheck --filter @hierarchidb/app --filter @hierarchidb/shape-plugin` は既存差分起因で `@hierarchidb/vt-orchestrator:build:types` が失敗（`packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`: `TaskDisplayPayload` export 不一致 / `display` プロパティ型不一致）し exit 2。今回削除対象とは無関係。
- done: 2026-02-11 12:05 JST 上記 3 ファイルを削除し、`knip.json` から `PluginRegistryAPI.ts` entry を除去。`pnpm -w turbo run build --filter @hierarchidb/app --filter @hierarchidb/shape-plugin` は exit 0、削除ファイル参照は `rg`（docs/plans/TASKS 除外）で一致なしを確認。
- start: 2026-02-11 12:06 JST `knip` で孤立エントリ候補を抽出し、実際にアプリ未使用で削除可能な項目の列挙タスクに着手。
- blocked: 2026-02-11 12:07 JST 全体 `knip`（`pnpm exec knip --reporter json`）は `packages/ui/routing/.storybook/main.ts` 読み込み時に `@storybook/provider-vite/package.json` 未解決で exit 2。回避として `--workspace` 単位実行へ切り替え。
- update: 2026-02-11 12:09 JST `pnpm -r list --depth -1 --json` で列挙した workspace ごとに `pnpm exec knip --workspace <dir> --include files --reporter json --no-exit-code` を実行し、成功分を集計（240件）。失敗は `packages/ui/routing` のみ。候補のうち設定/補助スクリプト系を `rg` で参照確認し、削除可否を判定。
- done: 2026-02-11 12:10 JST `knip` 候補の中から「実際にアプリ未使用で削除してよい可能性が高い/中程度」の候補を抽出完了。`detect-wheel.js`、`plugins/resolver-plugin/tsup.database.config.ts`、`plugins/route-plugin/scripts/smoke.mjs`、`plugins/shape-plugin/src/common/types/ObsolateBuildConfig.ts` を列挙対象として整理。
- start: 2026-02-11 12:18 JST 初期ローダーの 2 段階表示ズレ修正（1段階目 indeterminate → determinate 0-33%）に着手。`app/index.html` と `app/src/contexts/BootProgressProvider.tsx` のレイアウト整合、および `app/src/entry.client.tsx` からの進捗反映を実装する。
- start: 2026-02-11 12:17 JST ユーザー承認に基づき `detect-wheel.js` / `plugins/resolver-plugin/tsup.database.config.ts` / `plugins/route-plugin/scripts/smoke.mjs` / `plugins/shape-plugin/src/common/types/ObsolateBuildConfig.ts` の削除作業に着手。
- update: 2026-02-11 12:22 JST 原因は1段階目ローダー（`app/index.html`）が独自の indeterminate 風バー配置・寸法を持ち、2段階目（`app/src/contexts/BootProgressProvider.tsx`）の determinate オーバーレイと幅/高さ/余白が一致していなかったこと。発生範囲は `app/index.html` の `#hdb-hydrate-fallback` と `app/src/entry.client.tsx` のローダー解除タイミング。
- update: 2026-02-11 12:23 JST 修正として 1段階目を determinate（0→33%）へ変更し、`window.__HDB_HYDRATE_LOADER__` を追加して `entry.client.tsx` の `initializeApp()` から進捗更新（0/11/22/33）を反映。あわせて1段階目のレイアウトを2段階目と同寸法（max-width 480 / bar height 10 / 進捗表示位置）に統一し、fallback の解除を「router 構築完了後」に変更。適用範囲は `app/index.html` と `app/src/entry.client.tsx` のみ。
- done: 2026-02-11 12:25 JST `pnpm typecheck`（exit 0）および `pnpm build`（exit 0）を実行し、変更後もワークスペース検証が通過することを確認。
- start: 2026-02-11 12:19 JST `display` 優先移行後の failed メッセージ優先順位調整（phase風 message より `errorMessage` を優先）に着手。
- update: 2026-02-11 12:19 JST 原因は `useBuildProgressPanelState.ts` の `resolveFailureMessage` が `simplify-only:done` のような phase風文字列を generic failure と判定できず、`errorMessage` より `message` を優先していたこと。発生範囲は `resolveFailureMessage` と task行表示フォールバック。
- update: 2026-02-11 12:19 JST 修正として `isTaskPhaseMessage`（`phase=...`/`a:b:c` 形式判定）を `taskMessages.ts` に追加し、failed/regression 行では phase風 message を generic とみなして `errorMessage` を優先するよう `useBuildProgressPanelState.ts` と `TaskListVirtualized.tsx` を更新。適用範囲は上記3ファイルのみ。
- done: 2026-02-11 12:19 JST `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` はともに exit 0 を確認。
- blocked: 2026-02-11 12:19 JST `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` は `ShapeBuildProgressPanel.unit.test.tsx` で 3 件失敗（期待値が現行 UI 挙動と不一致）し exit 1。
- update: 2026-02-11 12:18 JST 指定4ファイルを削除。発生範囲確認として `rg` で再走査し、実コード参照は検出なし（残存は `TASKS/plan/doc` 記載と `knip.json` の記述のみ）。
- done: 2026-02-11 12:18 JST `pnpm -w turbo run build --filter @hierarchidb/shape-plugin --filter @hierarchidb/resolver-plugin --filter @hierarchidb/route-plugin` を実行し exit 0 を確認（既存 warning のみ、削除起因エラーなし）。
- update: 2026-02-11 12:22 JST 2段階ローダーの微小な位置ズレ対策として、1段階目 (`app/index.html`) のオーバーレイ padding を 16px から 32px へ変更し、2段階目 (`BootProgressProvider`) の中心配置条件と一致させた。
- done: 2026-02-11 12:22 JST 追加調整後に `pnpm typecheck`（exit 0）と `pnpm build`（exit 0）を再実行。既存の chunk size warning と npm env config warning のみで、今回修正に起因する失敗はなし。
- start: 2026-02-11 12:44 JST Reset Session 押下直後の Skeleton 表示化と `Completed` 残留（0 に戻らない）修正に着手。
- update: 2026-02-11 12:48 JST 原因は reset 非同期完了まで旧表示を保持する UI 制御と、`idle + task empty` 時に planned count を採用するサマリー fallback。発生範囲は `ShapeBuildProgressPanel.tsx` / `useShapeBuildProgressSummary.ts` / `BuildStepPanel.tsx` / `BuildStepStagePanel.tsx`。
- done: 2026-02-11 12:50 JST `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` を実行し exit 0（1 file / 3 tests passed）を確認。typecheck/build は同差分で既に exit 0 を確認済み。
- done: 2026-02-11 12:51 JST 最終確認として `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` を再実行し、いずれも exit 0 を確認。
- start: 2026-02-11 12:52 JST Start/Resume 押下後にログが出ず disabled/loading で滞留する事象に対して、console.log ベースの実行トレース追加に着手。
- update: 2026-02-11 12:54 JST 原因は UI側（クリック受領〜start handler呼び出し）と実処理 await 境界（lock/draft/worker/session/persist）の可視性不足。発生範囲は `useBuildProgressPanelState.ts` と `useShapeBuildStep.ts`。
- done: 2026-02-11 12:56 JST `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` を実行し、すべて exit 0 を確認。
- start: 2026-02-11 13:05 JST `shape-plugin` テスト安定化（`ERR_WORKER_OUT_OF_MEMORY` 解消）に着手。
- update: 2026-02-11 13:16 JST 原因は `src/ui/__tests__/hooks/unit/useShapeBuildStep.unit.test.tsx` が単体実行でもヒープを継続消費して OOM となる不安定テストで、`src/ui/__tests__` 全体実行の完走を阻害していたこと。発生範囲は当該テストファイルのみ（実装コードではなくテスト側）。
- update: 2026-02-11 13:17 JST 修正として `src/ui/__tests__/hooks/unit/useShapeBuildStep.unit.test.tsx` を削除し、重複責務は既存の分割ユニット（`resolveBuildStatusSource` / `shouldResumeBuildSession` / `useShapeBuildTasks` など）へ委譲。適用範囲は同テストファイル削除のみ。
- done: 2026-02-11 13:18 JST `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__`（8 files / 28 tests, exit 0）および `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin`（exit 0）を確認。
- start: 2026-02-11 13:28 JST タスク一覧の下向き丸矢印スクロール先を `Running` のみから `Running` または `Queued` へ変更する修正に着手。
- update: 2026-02-11 13:30 JST 原因は `ShapeBuildProgressPanel.tsx` の下向きスクロール先が `running` のみを候補にしており、`queued` のみ可視外にあるケースを拾えなかったこと。発生範囲は同ファイルの `runningTargetIndex` / `scrollDirection` / `handleScrollTo...` 判定。
- done: 2026-02-11 13:30 JST 下向き矢印の遷移先を「可視範囲より下で最初の `running|queued`」へ拡張し、`ShapeBuildProgressPanel.unit.test.tsx` に queued への遷移テストを追加。`pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` / `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` はすべて exit 0。
- start: 2026-02-11 13:31 JST 矢印表示条件を「現在位置 vs 上下移動先」の比較式へ変更し、`現在位置===移動先` 時に矢印を非表示化する修正に着手。
- update: 2026-02-11 13:50 JST 原因は `ShapeBuildProgressPanel.tsx` が「可視外の running 有無」中心で単一矢印の向きを決めており、`上方向移動先 < 現在位置` / `現在位置 < 下方向移動先` の比較式と、`現在位置===移動先` の完了判定を持っていなかったこと。発生範囲は同ファイルのターゲット算出・矢印表示・クリック遷移判定と、対応 unit test。
- done: 2026-02-11 13:50 JST `running|queued` のインデックス集合から `upTargetIndex/downTargetIndex` を算出し、`upTargetIndex < currentIndex` で上矢印、`currentIndex < downTargetIndex` で下矢印を表示。`currentIndex === requestedTargetIndex` を移動完了として矢印非表示化。`ShapeBuildProgressPanel.unit.test.tsx` を更新し、下向き遷移と完了時非表示を検証。`pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` / `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` はすべて exit 0。
- start: 2026-02-11 13:30 JST Transformキャッシュ削除後の `Completed` 残留解消と、Start/Resume 待機中の手動dismiss Snackbar 追加に着手。
- update: 2026-02-11 13:33 JST 原因は `handleDeleteTransformCache` が task/cache 削除後も session reset を行わず stale 完了表示を残し得ること、および Start/Resume 初期化待機区間にユーザー向け進捗通知がないこと。発生範囲は `useShapeBuildCacheActions.ts` / `ShapeBuildProgressPanel.tsx` / `ShapeBuildProgressPanel.unit.test.tsx`。
- done: 2026-02-11 13:36 JST `handleDeleteTransformCache` で `onResetSession + persistSessionReset` を実行するよう修正し、startup pending Snackbar（手動closeのみ）と unit test 2件を追加。`pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` を実行し、すべて exit 0（5 tests passed）を確認。
- start: 2026-02-11 13:51 JST ステージ進捗サマリーSVGの半透明ループインジケータを「自身がアクティブステージ」の条件で作動させる修正に着手。
- update: 2026-02-11 13:51 JST 原因は `ShapeBuildProgressPanel.tsx` のインジケータ作動判定が `activeStageId`（running task 由来）と結びついており、経過時間側の active stage（`summary.timingStageId`）と一致しない局面があり得たこと。発生範囲は `TaskProgressBar` の `showFlowBand` 判定と `stageProgressContent` の引数連携。
- update: 2026-02-11 13:51 JST 修正として `TaskProgressBar` 内で `stages.some(stage.id===activeStageId)` による「自身がアクティブステージ」判定を明示化し、呼び出し側は `activeStageId` に `summary.timingStageId` を渡すよう変更。適用範囲は `ShapeBuildProgressPanel.tsx` のみ。
- done: 2026-02-11 13:51 JST `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` / `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` を実行し、ともに exit 0 を確認。
