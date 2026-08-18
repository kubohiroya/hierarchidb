# GitHub Issues + Project タスク管理方針

## 目的

タスクの状態、受け入れ基準、依存関係、検証結果、ロールバック手順を GitHub に集約し、ローカル文書との二重管理をなくす。

## SSOT

- タスクの実体: GitHub Issue
- 優先順位と進行状態: repository Project
- 実装とレビュー: 1 Issue = 1 branch = 1 worktree = 1 purpose の PR
- Issue 本文テンプレート: `docs/templates/task-issue-template.md`
- ローカル Markdown のタスク台帳は作成・更新しない。GitHub が利用できない場合もローカル台帳へフォールバックしない。

過去の台帳や ExecPlan に残る記述は履歴資料であり、現在のタスク状態を表さない。現在の判断には必ず GitHub Issue と Project を使う。

## Issue の必須項目

- Summary / Background
- Scope (In / Out)
- Dependencies
- Acceptance Criteria (DoD)
- Rollback Plan
- Verification Commands と期待結果
- 作業ブランチ、進捗、阻害要因、検証結果

## Project の運用

- 着手前に対象 Issue を Project へ追加する。
- `Status` は原則 `Todo` / `In Progress` / `Done` を使う。
- 阻害中を表す選択肢が Project にある場合はそれを使い、ない場合は `In Progress` のまま Issue に `blocked` の要因と解除条件を記録する。
- 優先度、規模、担当など利用可能なフィールドは、Project の現行スキーマに合わせる。文書側で存在しない選択肢を仮定しない。

## 着手フロー

1. 関連する `docs/` 配下の仕様書・設計書を確認する。
2. 仕様との矛盾があれば実装前に報告し、仕様を確定する。
3. DoD と Rollback Plan を提示し、ユーザー承認を得る。
4. Issue を作成し、Assignee を設定する。
5. Issue を Project に追加し、`Status=In Progress` にする。
6. `<type>/<scope>/<slug>` 形式のブランチと専用 worktree を作る。
7. 以上を満たしてから編集と検証を開始する。

## 実装・検証

- 小さくレビュー可能な差分に分ける。
- 影響範囲に応じて package 限定検証またはルート検証を実行する。
- 実行コマンド、終了コード、要点を Issue に記録する。
- 失敗時は原因、発生範囲、解除条件を Issue に記録する。

## PR・完了

1. PR に対象 Issue をリンクし、Scope、DoD、Rollback、Verification を記載する。
2. マージ前に DoD と検証結果を確認する。
3. マージ後に Issue を Close し、Project を `Done` にする。
4. worktree が clean であることを確認してから、worktree とローカルブランチを安全に削除する。

## GitHub が利用できない場合

- Issue の作成または必要な更新ができなければ、実装を開始・継続しない。
- 失敗コマンド、エラー要約、解除条件をユーザーへ報告する。
- GitHub 復旧後に Issue / Project を更新してから再開する。

## 外部公開操作

Issue / Project / PR の作成・編集・コメント・Close・Merge、`git push` などの公開操作は、対象と操作を特定したユーザーの明示承認後に実行する。詳細は `AGENTS.md` の権限境界に従う。
