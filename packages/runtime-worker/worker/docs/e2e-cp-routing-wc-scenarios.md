vk:doc kind=guide audience=dev scope=e2e

# E2E シナリオ草案: CPルーティング + WC フロー

目的
- フラグ OFF/ON の双方で create/update/move/remove/recover と WC commit を通し、回帰と競合動作を確認する。

前提
- Node >= 20, pnpm >= 9
- start-env 経由でフラグ注入

シナリオ（OFF）
- WORKER_USE_CMDPROC_CREATE_UPDATE=0 / WORKER_USE_CMDPROC_MOVE_REMOVE=0 / WORKER_WC_COMMIT_V2=0
- 手順:
  - create → update → move → remove → recover
  - WC: draft 作成 → commit（レガシー互換） → discard
- 期待:
  - 従来経路と同等の動作、ログ/イベントに変化なし

シナリオ（ON）
- WORKER_USE_CMDPROC_CREATE_UPDATE=1 / WORKER_USE_CMDPROC_MOVE_REMOVE=1 / WORKER_WC_COMMIT_V2=1
- 手順:
  - create/update/move/remove/recover が CP 経由で成功
  - Policy C: サブツリーに WC があれば move/remove を INVALID_OPERATION でブロック
  - WC commit V2: NAME_CONFLICT → VALIDATION_ERROR（suggestedName 提示）、COMMIT_CONFLICT → COMMIT_CONFLICT
- 期待:
  - Undo/Redo が update/move/remove/recover で機能
  - ErrorCode と戻りは Core に整流済み

レポート
- e2e-results/ へ JSON/XML を保存（CIで収集）

