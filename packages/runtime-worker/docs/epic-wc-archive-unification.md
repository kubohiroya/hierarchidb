vk:task id=epic-wc-archive-unification status=in_progress priority=P0 labels=epic,draft,archive,docs,ui

# エピック: Draft/Archive 統合ロードマップ

## ゴール
- Draft と Archive の内部表現を holder+child へ統一し、ポリシーC・単一WC共有・一意エンコード・Tx一貫性を確立する。

## 実行順序（ガイド）
1. 仕様/ADRの確定（docsのみ） → `wc-spec-sync`, `wc-entity-spec`
2. ユーティリティ基盤の導入 → `wc-util-baseline`
3. Draft実装の仕様アライン → `wc-impl-align`
4. ポリシーCの適用（移動/削除ガード） → `tree-guard-policy-c`
5. Archive の holder 方式への統合（フラグで段階適用） → `archive-holder-refactor`
6. UI 導線（配下WCの編集再開/競合表示） → `ui-resume-wc-under-subtree`
7. 仕上げ（GC/メトリクス/文書更新） → `cleanup-metrics`

## トラッキング
- 依存: `docs/adr/adr-single-draft-per-target.md`, `docs/adr/adr-block-move-delete-when-wc-in-subtree.md`, `docs/adr/adr-draft-archive-unification.md`
- 参照: `docs/draft-holder-encoding.md`, `docs/draft-ops-pseudocode.md`, `docs/holder-pair-pattern.md`
