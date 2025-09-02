vk:task id=wc-impl-align status=todo priority=P1 labels=worker,working-copy,impl

# タスク: WorkingCopy 実装の仕様アライン

## 目的
- 仕様（単一WC共有/エンコードv1/コミット戻り型/検索式）に実装を整合させる。

## 作業
- holder.name 第2要素を「targetNodeId」に統一（現状の holderId を修正）
- `getWorkingCopy(...)` を holder走査＋decode 方式に切替
- create を get-or-create（ユニーク制約＋再試行、`returnedExisting`返却）に変更
- commit の戻り型を標準化（`ok | COMMIT_CONFLICT | NAME_CONFLICT`＋メタ）

## 依存
- `wc-util-baseline`
- 仕様: `docs/working-copy-ops-pseudocode.md`, `docs/working-copy-holder-encoding.md`
- エピック: `epic-wc-trash-unification`

## 受け入れ基準
- 既存テスト非回帰。新ロジックのユニット追加で戻り/冪等/競合/rename を確認。
