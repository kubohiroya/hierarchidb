vk:task id=trash-holder-refactor status=planning priority=P1 labels=worker,tree,trash,refactor

# タスク: Trash を holder ペア方式へ統合

## 背景
- 現行の Trash はノード本体に `originalParentId`/`originalName` を保持し、`trashRoot` 直下へ物理移動している。
- WorkingCopy は holder+child ペア方式。両者でパターン統一し、命名衝突回避と復元処理の共通化を図る。

## 変更方針
- `trashRoot` 直下に Trash holder を作成し、child に実体ノードをぶら下げる。
- holder.name = `${originalParentNodeId}\t${trashedNodeId}`（v1）。
- 復元: holder.name から `originalParentId` を取得、child.name をベースに `createNewName`（必要なら自動リネーム）で復元。
- ノード本体の `originalParentId`/`originalName` は新規書き込みを停止（読みは移行期間のみ対応）。

## 実装ステップ（PR粒度の目安）
1. 共通ユーティリティ導入: `src/services/utils/holder-encoding.ts`（完了）
2. Trash作成API（moveToTrash）に holder 方式を追加（フラグ `useTrashHolder`）
3. 復元API（recoverFromTrash）を holder 方式対応（両方式を読める）
4. 互換フィールドの廃止: `originalParentId`/`originalName` の書き込み停止、GCでクリーンアップ
5. ドキュメント/テスト更新（E2E: 名前衝突、復元先の検証）

## 受け入れ基準
- ゴミ箱への移動/復元が holder 方式で完了し、従来テストを満たす。
- 名前衝突時に `createNewName` が適用され、UI上の表示も期待通り。
- 互換フィールドの新規書き込みが停止している（読みは移行期間のみ）。

## 依存
- `docs/holder-pair-pattern.md`
- `docs/working-copy-holder-encoding.md`
 - エピック: `epic-wc-trash-unification`
 - `wc-impl-align`, `tree-guard-policy-c`
