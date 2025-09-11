# PLAN: WORKER_ENTITY_UNIFIED をデフォルトONにする

日付: 2025-09-10
対象フラグ: `WORKER_ENTITY_UNIFIED`
目的: ノード操作に付随するエンティティ（Peer/Group/Relation）の同期を統一ライフサイクルで既定有効化し、データの整合・連動を高める。

## 背景 / 現状
- 既定OFF。ON時、`EntityLifecycleManager` が各コマンド後に Best-effort でピア同期などを実施。
- ノードタイプごとのストア実装（peer/group/relation）が未整備だとNo-op。整備済みタイプでは追加I/Oが発生。

## 変更方針（デフォルトON化の要点）
1) 既定ON（環境 `0/false` でOFF）。
2) サポート対象ノードタイプの store 実装を棚卸し。未実装タイプは No-op のままでも動作継続。
3) 大量操作（duplicate/import/paste）時の bulk 経路を優先し、性能確保。

## 影響範囲 / 改修対象ディレクトリ
- Worker 本体（ライフサイクル）
  - `packages/runtime-worker/worker/src/config/feature-flags.ts`
  - `packages/runtime-worker/worker/src/entity/EntityLifecycleManager.ts`
  - `packages/runtime-worker/worker/src/entity/store-registry.ts`
  - `packages/runtime-worker/worker/src/entity/handlers/*`
  - `packages/runtime-worker/worker/src/services/WorkingCopyTreeNodeOperations.ts`（WC作成/破棄/コミット通知）
  - `packages/runtime-worker/worker/src/services/TreeMutationService.ts`（duplicate/import/paste の ID マッピング連携）
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`（成功時の通知）
- プラグイン/ストア（必要に応じて）
  - `packages/node-type/*-plugin/`（peer/group/relation store 実装の有無確認と補強）

## 実装ステップ
1) フラグ既定ON
   - `feature-flags.ts` の `WORKER_ENTITY_UNIFIED` 既定を true に。
2) 例外安全性の担保
   - すべてのライフサイクルハンドラで try/catch を維持（現状OK）。Worker のメインフローに影響を与えない。
3) IDマッピングの完全性
   - `duplicate/paste/import` で source→dest の ID マップが全ルートで登録/引継ぎされているか点検。部分木の内外を跨ぐ関係はスキップ（仕様通り）。
4) 性能最適化
   - `bulkUpsertFromIds` / `bulkUpsert` / `bulk` 系の利用をデフォルトケース化。
   - 大規模シナリオ（1000+ノード）での P95 を計測。
5) テスト
   - 単体: store 無し/一部のみ/全部あり の3状態での動作確認。
   - E2E: duplicate/import/paste で peer/group/relation が期待通り転写される。

## 受け入れ基準（DoD）
- フラグ未設定でライフサイクルが発火し、メイン操作成功率/レイテンシに有意な悪化がない。
- ストア未実装タイプでは No-op で安全にスルー。

## ロールバック手順
- 環境で `WORKER_ENTITY_UNIFIED=0` を設定してOFF。

## リスクと緩和
- 追加I/Oによる遅延 → bulk 経路の徹底、計測で閾値超過時は分割実行やスロットリングを導入。
- IDマッピング漏れ → 登録箇所を一元化し、ユニットで検証。漏れ時は Best-effort のためメインフローへ影響させない。

## 作業粒度とPR方針
- PR1: FEATURE_FLAGS 既定ON + 例外安全レビュー
- PR2: IDマッピング整合性テスト + bulk 経路の徹底
- PR3: 大規模E2E + 計測結果の最終確認

---

### 参考ファイル
- `packages/runtime-worker/worker/src/entity/EntityLifecycleManager.ts`
- `packages/runtime-worker/worker/src/services/WorkingCopyTreeNodeOperations.ts`
- `packages/runtime-worker/worker/src/services/TreeMutationService.ts`
- `packages/runtime-worker/worker/src/services/CommandProcessor.ts`

