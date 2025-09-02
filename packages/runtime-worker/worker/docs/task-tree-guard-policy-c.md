vk:task id=tree-guard-policy-c status=todo priority=P1 labels=worker,tree,policy,guard

# タスク: ポリシーCの適用（移動/削除ブロック）

## 目的
- サブツリーにWCが存在する場合、対象ノードの移動/削除（Trash移動含む）をブロックする。

## 作業
- `TreeMutationService` の move/remove 系にガード実装
- 検出は v1: BFS＋holder走査（将来 `wcInSubtreeCount` 最適化）
- エラーコード/メッセージの標準化（UIでの無効化/警告と連動）

## 依存
- `wc-impl-align`（WC検出が安定した後に適用）
- ADR: `adr-block-move-delete-when-wc-in-subtree`
- エピック: `epic-wc-trash-unification`

## 受け入れ基準
- サブツリー内にWCがある状況で move/remove が失敗し、UIに解消導線が表示される。
