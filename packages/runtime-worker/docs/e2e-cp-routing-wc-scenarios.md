vk:doc kind=guide audience=dev scope=e2e

# E2E シナリオ草案: CPルーティング + WC フロー

目的
- create/update/move/remove/recover が CommandProcessor 経由で一貫して動作すること、WC commit の挙動を確認する。

前提
- Node >= 20, pnpm >= 9
- CommandProcessor ルーティング / Archive ホルダー / Policy C / WC commit V2 は常時有効

ベースシナリオ
- 手順:
  - create → update → move → remove → recover
  - WC: draft 作成 → commit（V1 or V2） → discard
- 期待:
  - すべて CP 経由で成功し、Undo/Redo が有効

オプションシナリオ
- WC commit 競合 / 名前衝突ケースを人工的に作り、エラー取り扱いを検証
- Policy C ブロック検証（サブツリーに WC がある状態で move/remove を試行）

レポート
- e2e-results/ へ JSON/XML を保存（CIで収集）
