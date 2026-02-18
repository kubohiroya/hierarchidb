vk:task id=wc-impl-align status=todo priority=P1 labels=worker,draft,impl

# タスク: Draft 実装の仕様アライン

## 目的
- 仕様（単一WC共有/エンコードv1/コミット戻り型/検索式）に実装を整合させる。

## 作業
- holder.name 第2要素を「targetNodeId」に統一（現状の holderId を修正）
- `getDraft(...)` を holder走査＋decode 方式に切替
- create を get-or-create（ユニーク制約＋再試行、`returnedExisting`返却）に変更
- commit の戻り型を標準化（`ok | COMMIT_CONFLICT | NAME_CONFLICT`＋メタ）

## 依存
- `wc-util-baseline`
- `spec-freeze-wc-impl-align`
- 仕様: `docs/draft-ops-pseudocode.md`, `docs/draft-holder-encoding.md`
- エピック: `epic-wc-archive-unification`

## 受け入れ基準
- 既存テスト非回帰。新ロジックのユニット追加で戻り/冪等/競合/rename を確認。

## 進捗
- 実装済み（最小差分）:
  - holder.name を `${targetParentId}\t${targetNodeId}` に修正（ドラフトは新規IDを先行採番）
  - `getDraft(originalNodeId)` を holder 走査＋decode に置換（`draftOf` 参照を撤廃）
- 未対応（別PRで実施）:
  - create の get-or-create 化（ユニーク制約＋再試行、`returnedExisting`）
  - commit 戻りスキーマの標準化（`ok | COMMIT_CONFLICT | NAME_CONFLICT`）
