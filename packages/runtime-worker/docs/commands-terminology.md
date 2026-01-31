# コマンド用語整合（Envelope v1）

目的
- コマンド名の意味範囲を明確化し、実装・UI・テスト間の用語不一致を防止する。

基本方針
- trash 運用を明示化する。
  - moveToTrash: ノードをゴミ箱へ移動（復元可能）。
  - recoverFromTrash: ゴミ箱から復元。
  - remove: 物理削除（恒久的）。UI からの直呼びは原則禁止（保守用）。
- Draft ライフサイクルを v1 として固定。
  - createDraftForCreate → commitDraftForCreate
  - createDraft → commitDraft / discardDraft
- 名前衝突の取り扱い
  - onNameConflict: 'error' | 'auto-rename' を全コマンドで統一。

Envelope v1 マッピング（抜粋）
- moveNodes: { nodeIds, toParentId, onNameConflict? }
- duplicateNodes: { nodeIds, toParentId, onNameConflict? }
- pasteNodes: { nodes, nodeIds, toParentId, onNameConflict? }
- moveToTrash: { nodeIds }
- recoverFromTrash: { nodeIds, toParentId?, onNameConflict? }
- importNodes / copyNodes / exportNodes: 既存の型を踏襲
- Draft 系: create*/commit*/discard* の各 payload は common-type 定義を使用

ロールバック指針
- すべての段階導入はフラグ既定OFFで行い、問題発生時はフラグOFFで即切戻し。

備考
- CommandMap（registry.plugin-definition.ts）で型を単一箇所に集約し、`PayloadOf<K>` / `ResultOf<K>` を通して利用側の整合を強制する。

