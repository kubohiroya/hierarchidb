vk:task id=epic-wc-trash-unification status=in_progress priority=P0 labels=epic,working-copy,trash,docs,ui

# エピック: WorkingCopy/Trash 統合ロードマップ

## ゴール
- WorkingCopy と Trash の内部表現を holder+child へ統一し、ポリシーC・単一WC共有・一意エンコード・Tx一貫性を確立する。

## 実行順序（ガイド）
1. 仕様/ADRの確定（docsのみ） → `wc-spec-sync`, `wc-entity-spec`
2. ユーティリティ基盤の導入 → `wc-util-baseline`
3. WorkingCopy実装の仕様アライン → `wc-impl-align`
4. ポリシーCの適用（移動/削除ガード） → `tree-guard-policy-c`
5. Trash の holder 方式への統合（フラグで段階適用） → `trash-holder-refactor`
6. UI 導線（配下WCの編集再開/競合表示） → `ui-resume-wc-under-subtree`
7. 仕上げ（GC/メトリクス/文書更新） → `cleanup-metrics`

## トラッキング
- 依存: `docs/adr/adr-single-working-copy-per-target.md`, `docs/adr/adr-block-move-delete-when-wc-in-subtree.md`, `docs/adr/adr-workingcopy-trash-unification.md`
- 参照: `docs/working-copy-holder-encoding.md`, `docs/working-copy-ops-pseudocode.md`, `docs/holder-pair-pattern.md`
