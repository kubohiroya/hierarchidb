# TASKS.md

## Doing

- #1179 / `chore/worker-provider/remove-unused-exports` / 2026-04-08 開始
- #1177 / `fix/worker-provider/remove-822-debug-logs` / 2026-04-08 開始
- #1175 / `chore/treeconsole/migrate-atomfamily-jotai-family` / 2026-04-08 開始
- #1155 / `feat/ide-gsm-client/implement` / 2026-03-27 開始
- #1127 / `fix/shape-plugin/task-progress-version-gate-and-idle-fallback` / 2026-03-17 開始
- #1020 / `refactor/shape-plugin/build-session-event-redesign-1020` / 2026-03-14 開始
- #1019 / `fix/shape-plugin/task-snapshot-race-on-build-start-1019` / 2026-03-14 開始
- #1018 / `fix/shape-plugin/runtime-refresh-after-start-1018` / 2026-03-14 開始

## Blocked

- 2026-03-09: mapでshape-styler同一フォルダ紐付け実装着手 blocked（`gh issue create` 実行時 `gh: command not found`、`apt-get install gh` はプロキシ 403 で失敗）。解除条件: `gh` CLI を利用可能にする（プリインストールまたは実行可能パス提供）。

## 今日の運用ログ

- 2026-03-26: #1157 yaml-file-node 全タスク実装・PR #1158 作成
- 2026-03-18: #1152 nodeId 型統一（string → NodeId）・PR #1153 マージ済み
- 2026-03-18: #1143 eventEmission/eventBuffering を build-runtime-services に昇格・PR #1151 マージ済み
- 2026-03-18: #1149 subscribeBuildProgress → subscribeTaskProgress リネーム・PR #1150 マージ済み
- 2026-03-18: #1147 レビュー対応コミット push・PR #1148 マージ済み
- 2026-03-18: docs 整合性修正（build-session-worker-ui-event-spec/design の nodeId 型・eventVersion 矛盾解消、draft-dialog-hosting 日本語混入修正、TASKS.md Doing 欄クリーンアップ）
