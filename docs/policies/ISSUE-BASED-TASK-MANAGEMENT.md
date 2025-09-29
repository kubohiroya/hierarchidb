# GitHub Issues を単一情報源 (SSOT) とするタスク運用ガイド

## 目的
- これまで `TASKS.md` に分散していたタスク情報を GitHub Issues へ移行し、単一情報源として運用する。
- CLI (`gh` コマンド) を活用し、ブランチ作成・タスク進行・レビュー依頼を一貫して行う。
- ワークツリー／ブランチ運用、運用ログ、受け入れ基準を Issues 側でトレースできるようにする。

## 基本フロー
1. **着手前確認**
   - `gh issue list --label P1 --state open` 等で優先度順に課題を確認する。
   - 新規タスクが必要な場合は `gh issue create` を用い、テンプレート (後述) に沿って必須情報を登録する。
2. **ブランチ／ワークツリー作成**
   - ブランチ命名は従来どおり `<type>/<scope>/<slug>`。
   - `gh issue develop <issue-number> --checkout` が使える環境では活用し、issue とブランチを自動でひも付ける。利用不可の場合は以下を手動で実施する。
     ```bash
     git worktree add ../worktrees/<branch> -b <branch>
     gh issue comment <issue-number> --body "Started worktree at ../worktrees/<branch>"
     ```
3. **進行管理**
   - 着手時: Issue に `status:in-progress` ラベルを付与、コメントで開始時刻・担当を記録。
   - ブロック時: `status:blocked` ラベルへ付け替え、阻害要因をコメントし、アンブロック条件を明記。
   - 完了時: PR を作成し Issue をリンク (`gh pr create --fill --issue <issue-number>`)、受け入れ基準をコメントでチェックしてからクローズ。
4. **運用ログ**
   - 日次メモは Issue コメントに `## Daily Log (YYYY-MM-DD)` として追記する。
   - まとめたい場合は後述の運用ログテンプレートを利用する。

## Issue テンプレート (推奨)
```
### Summary
- 背景:
- 目的:

### Acceptance Criteria
- [ ] 

### Rollback Plan
- 

### Work Log
- 2025-09-29 start: 作業開始メモ

### Dependencies
- #123, #124
```
- CLI から登録する場合は `gh issue create --template ssot-task.yml` 等のテンプレートを用意し、`.github/ISSUE_TEMPLATE` に保存する。
- 既存テンプレートが無い場合でも上記項目を Issue 本文へコピーして運用する。

## ラベル運用 (推奨セット)
| ラベル              | 用途                                  |
| ------------------- | ------------------------------------- |
| `type:feat`         | 機能追加                             |
| `type:fix`          | 不具合修正                           |
| `type:chore`        | ドキュメント整備や設定変更           |
| `priority:P0`〜`P3` | 優先度管理                           |
| `status:triage`     | 要分析の新規課題                     |
| `status:in-progress`| 着手済み                             |
| `status:blocked`    | ブロック中                            |
| `status:review`     | PR レビュー待ち                      |
| `status:done`       | マージ済み／クローズ済み             |

## 運用ログテンプレート
Issue コメントに以下を追記することで、従来の `TASKS.md`「運用ログ」を代替する。
```
## Daily Log (YYYY-MM-DD)
- start 09:15 Z:
- done 11:00 Z:
- blocked:
```
- ブロック時は `blocked` 項目で要因と解除条件を箇条書きする。

## gh コマンド例
```bash
# 優先度上位の課題一覧
gh issue list --label priority:P0 --state open

# 新規 Issue 作成 (テンプレート使用)
gh issue create --template ssot-task.yml --label type:feat,priority:P1

# 作業開始メモ
gh issue comment 123 --body "Start work on branch feat/ui/example"

# ラベル更新
gh issue edit 123 --add-label status:in-progress --remove-label status:triage

# PR 作成時に Issue とリンク
gh pr create --fill --issue 123
```

## 既存 `TASKS.md` からの移行
1. `TASKS.md` の「Doing」「ToDo」「Next Up」を順に確認し、それぞれ GitHub Issue へ登録する。
2. 受け入れ基準・チェックリスト／ロールバック手順は Issue テンプレートの該当欄へ転記する。
3. 旧 `TASKS.md` の内容は必要に応じて Issue コメントに貼り付け、参照履歴を保持する。
4. 移行完了後、`TASKS.md` は「参照用アーカイブ」とし、以後更新しない。

## 補足
- `gh` CLI が利用できない環境では GitHub Web UI を用いて同様の項目を入力する。
- 将来的に GitHub Projects や自動化が必要になった場合は本ドキュメントを更新する。
```
