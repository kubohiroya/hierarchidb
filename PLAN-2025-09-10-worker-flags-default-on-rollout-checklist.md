# PLAN: デフォルトON一括ロールアウトの横断チェックリスト

日付: 2025-09-10
対象: `WORKER_WC_COMMIT_V2` / `WORKER_TRASH_USE_HOLDER` / `WORKER_POLICY_C` / `WORKER_TX_ENABLED` / `WORKER_ENTITY_UNIFIED`
目的: 各フラグの個別計画にまたがる横断的な作業・検証・運用手順を一元化する。

## 対象パッケージ/ディレクトリ（横断）
- Worker 本体: `packages/runtime-worker/worker/src/**`
- UI/アプリ: `app/**`, `packages/runtime-ui/**`
- スクリプト: `scripts/**`
- ドキュメント: `packages/runtime-worker/worker/docs/**`, `docs/**`

## 共通実装タスク
- FEATURE_FLAGS 既定ONポリシー
  - `feature-flags.ts` に個別デフォルト true を実装（環境 `0/false` はOFF）。
  - `TreeMutationService` 等の `process.env.*` 直参照は `FEATURE_FLAGS` に寄せる。
- ログ/メトリクス
  - 主要コマンドの latency を計測し、ON/OFF 比較を週次で可視化。
  - 重大失敗（TX 例外/整合性警告）を一元ログに集約。

## 共通テストタスク
- 互換性: フラグ未設定=ON / 明示OFF の両モードで全テスト行列を通す。
- 大規模ケース: 1k/5k/10k ノードでのレイテンシ、メモリ使用量をプロファイル。

## ロールアウト段階
1) Staging で個別に順次ON → 1週間監視
2) 本番 Canary 10% → 50% → 100%
3) 必要に応じてドキュメント/ガイド更新

## ロールバック（横断）
- いずれも環境で `=0` をセットし再起動。
- 影響度が高い `WORKER_TX_ENABLED` は最初に戻す。

## 完了条件
- すべてのフラグが既定ONで安定運用。エラーレート/レイテンシに退行なし。

