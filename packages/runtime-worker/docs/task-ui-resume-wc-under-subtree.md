vk:task id=ui-resume-wc-under-subtree status=todo priority=P2 labels=ui,draft,tree

# タスク: 「配下のワーキングコピー編集を順次再開」メニュー

## 背景 / 目的
- ポリシーCにより、サブツリー内にWCがある間は移動/削除を禁止する。
- ユーザが解消に向けて迅速に行動できるよう、配下のWCを一覧し、順次編集/コミット/破棄に誘導するUIを提供する。

## 要件
- ノード右クリック（コンテキスト）メニューに項目を追加。
- アクション時に、当該ノード配下のWC一覧を取得し、ダイアログで表示。
  - 編集WC/ドラフトWCの区別、対象ノード（または予定親）を表示。
  - 並び順: `updatedAt` 降順またはツリー順（要選定）。
- 各WCに対して「開く（再開）/コミット/破棄」の操作を提供。

## データ取得（初期案）
- サブツリー列挙: `parentId` インデックスでBFSし、サブツリーのnodeId集合Sを得る。
- WC検出: draftRoot直下のholderを走査し、`decodeHolderName(name)`で
  - 編集WC: `targetNodeId ∈ S`
  - ドラフトWC: `targetParentNodeId ∈ S`
- 最適化（将来）: `wcInSubtreeCount` カウンタを持たせ、判定/取得を高速化。

## 受け入れ基準
- 移動/削除がブロックされた際、メニューから配下WCの一覧→再開/コミット/破棄の導線が表示される。
- サブツリー内WCが0件の場合はメニュー項目を非表示または無効化。

## 依存
- ADR: `docs/adr/adr-block-move-delete-when-wc-in-subtree.md`
- エンコードAPI: `encodeHolderName` / `decodeHolderName`（仕様化/実装）
 - エピック: `epic-wc-archive-unification`
 - 実装: `tree-guard-policy-c`, `wc-impl-align`
