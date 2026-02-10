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

## 今日は着手（運用ログ）

- start: 2026-02-11 07:31 JST 旧 `TASKS.md` 長大化のため、日付付き Obsolete アーカイブ化と新運用ハブへの移行に着手。
- done: 2026-02-11 07:39 JST `TASKS.obsolete.2026-02-10.md` へ凍結アーカイブし、新 `TASKS.md` と `docs/task-management.md` / `docs/templates/task-issue-template.md` を作成。
- start: 2026-02-11 07:42 JST Shape Step5 Transform の進捗通知を再編し、`100% Completed` メッセージ上書き揺れを防ぐ修正に着手。
- update: 2026-02-11 07:47 JST 原因は Transform ハンドラが `running` 状態の phase 更新でも `progress=100` を通知しうる実装（`encode:done` / `cache:put:start`）で、最終 `completed` メッセージと同じ 100% 帯で複数 message が競合していたこと。発生範囲は `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` の `updateTaskPhase` 経路。
- update: 2026-02-11 07:48 JST 修正として `normalizePhaseProgress` の戻り値を最大 `99` に制限し、`100` は `completed` 更新（`finalizeTaskWithCache` および completed return）でのみ到達するよう再編。適用範囲は同ファイルのみ。
- done: 2026-02-11 07:49 JST `vt-orchestrator` の typecheck/build と shape-plugin の関連ユニットテストを実行し、すべて exit 0 を確認。
- start: 2026-02-11 07:45 JST 新タスク管理方針（Issue/Project主導 + `TASKS.md` ハブ）を `AGENTS.md` へ明記する移行作業に着手。
- done: 2026-02-11 07:49 JST `AGENTS.md` を新方針へ更新し、旧 `TASKS.md` 単一SSOT 記述を Issue/Project 主体へ移行。
