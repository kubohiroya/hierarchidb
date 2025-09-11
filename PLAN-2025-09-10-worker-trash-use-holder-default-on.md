# PLAN: WORKER_TRASH_USE_HOLDER をデフォルトONにする

日付: 2025-09-10
対象フラグ: `WORKER_TRASH_USE_HOLDER`
目的: ゴミ箱機能をホルダー方式（Trash Holder）に統一し、復元と一貫性を高信頼化する。

## 背景 / 現状
- 既定OFF。旧方式（`removedAt`/`original*` フィールド直書き）と新方式（ホルダーノード）の二重対応。
- 新方式は `holder` の `name` に `originalParentNodeId\ttrashedNodeId` をエンコードし、復元情報を構造化保持。
- `TreeMutationService.moveNodesToTrash` が `process.env.WORKER_TRASH_USE_HOLDER` を直接参照しており、FEATURE_FLAGS と一貫していない。

## 変更方針（デフォルトON化の要点）
1) フラグ既定ON（環境で明示0ならOFF）。
2) `TreeMutationService` からの参照を `FEATURE_FLAGS.WORKER_TRASH_USE_HOLDER` に統一。
3) 旧データの移行ツールを提供し、UI/レポートで差分監視。

## 影響範囲 / 改修対象ディレクトリ
- Worker 本体
  - `packages/runtime-worker/worker/src/config/feature-flags.ts`
  - `packages/runtime-worker/worker/src/services/TreeMutationService.ts`
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`（moveToTrash/recoverFromTrash）
  - `packages/runtime-worker/worker/src/services/utils/holder-encoding.ts`
  - `packages/runtime-worker/worker/src/services/utils/policy-c.ts`（WC探索の最適化確認）
- スクリプト/移行
  - `scripts/` または `packages/runtime-worker/worker/scripts/` に移行スクリプト追加（旧 removedAt → holder 化）。
- ドキュメント
  - `packages/runtime-worker/worker/docs/trash-migration-runbook.md` の更新（既定ON前提に）

## 実装ステップ
1) フラグ既定ON
   - `feature-flags.ts` で `WORKER_TRASH_USE_HOLDER` を既定 true に（環境値 `0/false` でOFF）。
   - `TreeMutationService.moveNodesToTrash` の `process.env` 直参照を削除し、`FEATURE_FLAGS` へ統一。
2) コマンド経路の整合
   - `CommandProcessor` の `moveToTrash`/`recoverFromTrash` で holder 方式が既定で通ることを最終確認。
   - 名前衝突・自動リネーム・復元先決定ロジックのテスト補強。
3) 旧データ移行スクリプト
   - Dexie 上の既存 `removedAt` を持つノードをスキャン→対応する holder を作成→ノードを holder 配下へ移動→旧フィールドを除去。
   - idempotent に設計（再実行安全）。Dry-run オプションとレポート出力を実装。
4) UI/UX の微修正
   - Trash 表示/復元UIが holder 方式前提でも破綻しないことを確認。
5) テスト
   - ユニット: エンコード/デコード、移行スクリプト、復元パス。
   - E2E: 移行後の復元→再ゴミ箱→復元の往復。

## 受け入れ基準（DoD）
- フラグ未設定で holder 方式が動作し、旧方式のパスが実行されない。
- 既存DB（旧方式含む）に対して移行スクリプトが正常終了し、差分レポートが期待通り。
- 復元先・名前衝突処理が仕様通り（サジェスト/auto-rename）。

## ロールバック手順
- 環境で `WORKER_TRASH_USE_HOLDER=0` を設定しOFF。
- 旧方式での表示/復元ロジックを一時復活（分岐は保持）。

## リスクと緩和
- 旧データ移行におけるメタ欠落 → 可能な限り復元、不可の場合はレポートし人手対応。Dry-run + バックアップ/エクスポートを導入。
- UI の旧方式依存 → 先にE2Eで双方のUI動線を確認。

## 作業粒度とPR方針
- PR1: FEATURE_FLAGS 既定ON + `TreeMutationService` のフラグ参照統一
- PR2: 移行スクリプト + ユニット/E2E
- PR3: ドキュメント更新 + ステージング実運用手順

---

### 参考ファイル
- `packages/runtime-worker/worker/src/services/TreeMutationService.ts`
- `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
- `packages/runtime-worker/worker/src/services/utils/holder-encoding.ts`
- `packages/runtime-worker/worker/docs/trash-migration-runbook.md`

