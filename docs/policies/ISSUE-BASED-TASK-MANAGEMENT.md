# GitHub Issues を単一情報源 (SSOT) とするタスク運用ガイド

## 方針

- タスクの詳細は GitHub Issues、優先順位と状態は repository Project で管理する。
- ローカル Markdown のタスク台帳は廃止し、復活させない。
- ブランチ、worktree、PR、検証結果、阻害要因、ロールバック手順を対象 Issue から追跡可能にする。
- 詳細な着手ゲートと障害時の扱いは `docs/task-management.md` を正規仕様とする。

## 基本フロー

1. GitHub で既存 Issue と依存関係を確認する。
2. DoD と Rollback Plan の承認後、必要なら Issue を作成する。
3. Issue を Project に追加して `Status=In Progress` とし、Assignee を設定する。
4. `<type>/<scope>/<slug>` のブランチと専用 worktree を作る。
5. 小さい差分で実装し、進捗、阻害要因、検証コマンドと終了コードを Issue に記録する。
6. PR に Issue をリンクし、マージ後に Issue と Project を完了状態にする。

## Issue コメント例

```markdown
## Work Log (YYYY-MM-DD)

- start: branch `<type>/<scope>/<slug>`
- verification: `<command>` (exit 0)
- blocked: `<cause>`; unblock when `<condition>`
```

## 移行済みローカル台帳の扱い

- 削除済み台帳は Git 履歴だけを参照し、現在の状態判断には使わない。
- 過去の ExecPlan や設計書に残る台帳名は当時の履歴であり、新規記録先ではない。
- 未移行の作業候補を発見した場合は、必要性を再評価して新しい Issue として起票する。古い台帳ファイルは復元しない。

## GitHub が利用できない場合

- Web UI または `gh` のどちらでも Issue / Project を更新できない場合は blocked として停止する。
- ローカル台帳へフォールバックせず、解除条件をユーザーへ報告する。
