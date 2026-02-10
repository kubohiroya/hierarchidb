# Task Management Policy (Scalable)

## 目的

巨大な単一 Markdown でのタスク運用を廃止し、検索性・並列性・監査性を改善する。

## 現在のソース構成

- 運用ハブ: `TASKS.md`
- 旧台帳（参照専用）: `TASKS.obsolete.2026-02-10.md`
- 実タスク台帳: GitHub Issues + Project
- Issue 本文テンプレート: `docs/templates/task-issue-template.md`

## 単位と責務

- 1 Issue = 1 タスク
- 1 PR = 1 目的（小粒）
- 親子関係:
  - Epic Issue: 成果物を束ねる
  - Child Issue: 実装・検証の実行単位

## 必須フィールド（Issue）

- Summary
- Background
- Scope (In/Out)
- Dependencies
- Acceptance Criteria (DoD)
- Rollback
- Verification Commands

## Project 推奨フィールド

- `Status`: Backlog / Ready / Doing / Blocked / Review / Done
- `Priority`: P0 / P1 / P2 / P3
- `Area`: app / packages / plugins / docs / infra
- `Due`: date
- `Owner`: assignee

## 運用フロー

1. Task 起票
- `docs/templates/task-issue-template.md` を Issue 本文へ貼り付けて起票。
- DoD と Rollback を先に定義する。

2. 着手
- ブランチ作成: `<type>/<scope>/<slug>`。
- `TASKS.md` の `Doing` へ 1 行追加（Issue 番号とブランチ名）。

3. 実装
- 小さい差分で進める。
- 主要検証: `pnpm lint && pnpm format && pnpm typecheck && pnpm test`

4. 完了
- PR に `Refs #<issue>` を記載。
- `TASKS.md` から `Doing` を削除、`Done` は Issue/Project 側に集約。

## 旧台帳からの移行ルール

- `TASKS.obsolete.2026-02-10.md` は追記禁止。
- 移行対象は優先順で Issue 化:
  1. `進行中` かつ直近 14 日更新
  2. `blocked` で解消見込みがあるもの
  3. 未着手の高優先度項目
- 各移行 Issue の末尾に、旧台帳の参照を残す。
  - 例: `Source: TASKS.obsolete.2026-02-10.md:464`

## ロールバック

- もし Issue/Project 運用に問題が出た場合:
  1. `TASKS.md` に一時的 Kanban（Doing/Blocked/ToDo）を拡張
  2. 原因分析完了まで新規 Issue 起票を継続
  3. 復旧後に `TASKS.md` を再び薄いハブへ戻す
