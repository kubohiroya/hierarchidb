vk:doc kind=spec audience=dev scope=worker,tree

# Holder Pair Pattern（共通化方針）

目的
- Tree の特殊運用（WorkingCopy / Trash）で「親子ペア（holder + child）」の同一パターンを採用し、実装・命名衝突回避・復元/コミット処理のコード共有を図る。

共通の基本
- holder は特別なルートの直下（`workingCopyRoot` / `trashRoot`）にのみ存在。
- child は holder の直下に1件のみ。
- holder.name はエンコード規約で「元の親ID＋対象ID」を表現（TAB区切り、v1）。
- 検索は `[parentId+name]` インデックスか `parentId` 走査＋decode で実現。

エンコード規約（v1）
- WorkingCopy: `${targetParentNodeId}\t${targetNodeId}`
- Trash: `${originalParentNodeId}\t${trashedNodeId}`（名前は holder 側に埋め込まない）
- いずれも ID に TAB を含めない前提。将来 v2 で Base64 等に拡張可。

ユーティリティ
- `src/services/utils/holder-encoding.ts` に共通 encode/decode 実装を追加（v1）。

WorkingCopy への適用
- 既存仕様どおり（単一WC共有、コミット時楽観ロック、名前衝突は auto-rename）。

Trash への適用（統合案）
- 変更前: ノードを `trashRoot` 直下へ物理移動し、ノード自身に `originalParentId`/`originalName` を保持。
- 変更後: ノードを `trashRoot` 直下の holder の子に移動。holder.name に `originalParentId` と `trashedNodeId` をエンコード。
  - 復元先の決定: holder.name から `originalParentId` を取得。
  - 復元名の決定: child の `name` をベースに、衝突時は `createNewName` で auto-rename。
  - ノード本体に `originalParentId`/`originalName` を書かない（責務を holder 側へ移管）。

利点
- 名前衝突を `trashRoot` 直下で回避（holder が名前空間を吸収）。
- ノード本体に一時的プロパティを混在させず、復元処理を明確化。
- WorkingCopy とのパターン共有で、インデックスとユーティリティの再利用が可能。

移行計画（概要）
1) ユーティリティ導入（本ドキュメントの通り）
2) Trash 実装の behind-the-flag 置換（holder 方式で作成/復元）
3) `originalParentId`/`originalName` を段階的に廃止（読みは互換維持、書きは停止）
4) E2E/ユニットで復元・衝突・一括操作を検証

関連
- `docs/working-copy-holder-encoding.md`
- `docs/working-copy-ops-pseudocode.md`
- `docs/adr/adr-block-move-delete-when-wc-in-subtree.md`
- `docs/adr/adr-single-working-copy-per-target.md`

