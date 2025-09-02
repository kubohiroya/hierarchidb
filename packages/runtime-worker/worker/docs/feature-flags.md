vk:doc kind=guide audience=dev scope=worker

# Worker 機能フラグ一覧（設計）

目的
- ランタイムの挙動を安全に段階切替できるよう、機能フラグの命名・既定値・作用範囲を明記します。
- 現時点では設計ドキュメントのみ（実装は別PR）。

共通ルール
- 既定は安全側（OFF）。
- 値は文字列 `"0" | "1"`。起動時に確定（動的切替なし）。
- 作用範囲は最小に限定し、副作用の差分をドキュメント化する。

---

## WORKER_USE_CMDPROC_CREATE_UPDATE（deprecated）
- 概要: `createNode` / `updateNode` を CommandProcessor 経由に切替するための段階導入フラグ。
- 状態: 2025-09-02 以降は常時 CommandProcessor 経由となり、本フラグは無視されます。
- ロールバック: 旧経路は削除済みのため、直前タグへリバートしてください。

関連ドキュメント
- `docs/task-create-update-routing-draft.md`
- `docs/task-phased-routing-to-commandprocessor.md`
## WORKER_USE_CMDPROC_MOVE_REMOVE（deprecated）
- 概要: `move/remove` を CommandProcessor 経由に切替するための段階導入フラグ。
- 状態: 2025-09-02 以降は常時 CommandProcessor 経由となり、本フラグは無視されます。
- ロールバック: 旧経路は削除済みのため、直前タグへリバートしてください。
