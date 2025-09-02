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

## WORKER_USE_CMDPROC_CREATE_UPDATE
- 概要: `createNode` / `updateNode` の実行経路を CommandProcessor 経由へ切替。
- 既定値: `"0"`（OFF）
- 作用範囲: `TreeMutationService.createNode` / `updateNode` のみ（その他は非対象）
- 目的: 監査・Undo/Redo の導入を安全に段階適用するためのフラグ。
- ロールバック: `"0"` に戻すだけで直 CoreDB 経路へ復帰。

設定例（開発/CI）
```
# scripts/start-env.sh から注入する想定（実装は別PR）
export WORKER_USE_CMDPROC_CREATE_UPDATE="1"
```

実装メモ（後続PR）
- 読み取り箇所: `packages/runtime-worker/worker/src/config/feature-flags.ts`（新規）
- 公開API化はしない（内部ユース）。
- 未指定/不正値は `"0"` と同義に扱う。

関連ドキュメント
- `docs/task-create-update-routing-draft.md`
- `docs/task-phased-routing-to-commandprocessor.md`

