# PLAN: WORKER_POLICY_C をデフォルトONにする

日付: 2025-09-10
対象フラグ: `WORKER_POLICY_C`
目的: サブツリー内に Working Copy（WC）が存在する場合の移動/削除を既定でブロックし、データ整合性を強化する。

## 背景 / 現状
- 既定OFF。ON時、`moveNodes` などで `hasWorkingCopyInSubtree()` をチェックして INVALID_OPERATION を返す。
- UI がブロック理由と解消手段（コミット/破棄）を案内しない場合、不可解なエラーに見える。

## 変更方針（デフォルトON化の要点）
1) 既定ON（環境で `0/false` 指定時のみOFF）。
2) WC 検出のパフォーマンス/正確性を点検（index活用・早期終了）。
3) UI で“WCがあるため操作不可”のガイダンスとショートカット操作を追加。

## 影響範囲 / 改修対象ディレクトリ
- Worker 本体
  - `packages/runtime-worker/worker/src/config/feature-flags.ts`
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`（`moveNodes`/`moveToTrash` などの前段でチェック）
  - `packages/runtime-worker/worker/src/services/utils/policy-c.ts`（探索/最適化/テスト）
- UI/アプリ
  - `app/` + `packages/runtime-ui/*`（ブロック時のダイアログ/解消導線）
- ドキュメント
  - `packages/runtime-worker/worker/docs/operations-constraints.md`（既定ON前提に更新）

## 実装ステップ
1) フラグ既定ON
   - `feature-flags.ts` で `WORKER_POLICY_C` を既定 true に変更。
2) パフォーマンス/正確性の補強
   - `policy-c.ts` の `hasWorkingCopyInSubtree()` で `trees` の workingCopyRootId 経由の anyOf 検索を優先（現状実装の再確認）。
   - フルスキャンへのフォールバックは維持しつつ、テストで大規模ツリーに対する遅延を計測。
3) UI/UX 実装
   - ブロック時のメッセージ（例: “このサブツリーに編集中の下書きが存在するため移動できません”）。
   - 解消ショートカット: 対象サブツリー直下の WC 一覧を提示→コミット/破棄操作をバッチで実行。
4) テスト
   - ユニット: 真偽陽性/偽陰性ケース（ホルダー名のデコード不正、孤児化など）を網羅。
   - E2E: 大規模サブツリー + 並行で WC 作成/削除が走る状況でも正確にブロック/解除されること。

## 受け入れ基準（DoD）
- フラグ未設定で Policy C が有効、ブロック理由が UI に明示される。
- 偽陽性（不要ブロック）/偽陰性（漏れ）が E2E 上で再現しない。
- 大規模データで P95 遅延が許容範囲（事前ベースライン比 5% 以内）。

## ロールバック手順
- 環境で `WORKER_POLICY_C=0` を設定してOFF。

## リスクと緩和
- 検出の取りこぼし → anyOf インデックス経由とフォールバックを二段構え維持、テスト強化。
- UI 未対応 → 先にUI実装/リリース、Worker側はエラーコード/メッセージを安定化。

## 作業粒度とPR方針
- PR1: FEATURE_FLAGS 既定ON + 検出実装の微最適化
- PR2: UI ダイアログと WC 一括処理導線
- PR3: 大規模シナリオ E2E + 計測ログ

---

### 参考ファイル
- `packages/runtime-worker/worker/src/services/utils/policy-c.ts`
- `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
- `packages/runtime-worker/worker/docs/operations-constraints.md`

