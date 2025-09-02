vk:doc kind=guide audience=dev scope=e2e

# E2E シナリオ草案: CPルーティング + WC フロー

目的
- create/update/move/remove/recover が CommandProcessor 経由で一貫して動作すること、WC commit の挙動を確認する。

前提
- Node >= 20, pnpm >= 9
- 必要に応じて下記フラグのみ利用: `WORKER_WC_COMMIT_V2`, `WORKER_TRASH_USE_HOLDER`, `WORKER_POLICY_C`（いずれも既定OFF）

ベースシナリオ
- 手順:
  - create → update → move → remove → recover
  - WC: draft 作成 → commit（V1 or V2） → discard
- 期待:
  - すべて CP 経由で成功し、Undo/Redo が有効

オプションシナリオ
- `WORKER_WC_COMMIT_V2=1`: WC commit V2 で競合時の戻りを検証
- `WORKER_POLICY_C=1`: サブツリーに WC があれば move/remove を INVALID_OPERATION でブロック

レポート
- e2e-results/ へ JSON/XML を保存（CIで収集）
