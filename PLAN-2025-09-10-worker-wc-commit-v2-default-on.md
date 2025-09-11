# PLAN: WORKER_WC_COMMIT_V2 をデフォルトONにする

日付: 2025-09-10
対象フラグ: `WORKER_WC_COMMIT_V2`
目的: Working Copy コミット処理を CommandProcessor 経由の V2 へ全面移行し、競合/名称衝突の厳密なハンドリングを既定とする。

## 背景 / 現状
- 現在は既定OFF。OFF時はレガシー経路（実質 no-op に近い成功や簡易破棄）を許容。
- ON時は `commitWorkingCopyV2()`（optimistic lock + 名前衝突ポリシー）を `CommandProcessor` から呼び出す実装が有効。
- UI 側が `COMMIT_CONFLICT` / `NAME_CONFLICT` を前提としていない場合、UX が破綻する可能性。

## 変更方針（デフォルトON化の要点）
1) Worker 側の既定値を ON に変更（環境で `0/false` 指定時のみOFF）。
2) UI 側で競合解消（再試行/自動リネーム受入れ）を標準化。
3) E2E でレース発生条件・大量コミットの健全性を確認し、DoD を満たしたら rollout。

## 影響範囲 / 改修対象ディレクトリ
- Worker 本体
  - `packages/runtime-worker/worker/src/config/feature-flags.ts`
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
  - `packages/runtime-worker/worker/src/services/WorkingCopyService.ts`
  - `packages/runtime-worker/worker/src/services/WorkingCopyTreeNodeOperations.ts`
  - `packages/runtime-worker/worker/src/entity/*`（ライフサイクル通知）
- UI/アプリ
  - `app/`（競合/名称衝突のUI処理: ダイアログ・再試行導線）
  - `packages/runtime-ui/*`（エラーメッセージの整備）
- スクリプト/ドキュメント
  - `scripts/env/*.sh`（明示OFF時の例）
  - `packages/runtime-worker/worker/docs/*`（V2を既定にする旨の更新）

## 実装ステップ
1) フラグ既定ON
   - `feature-flags.ts` にて `WORKER_WC_COMMIT_V2` のデフォルトを true に変更。
     - 実装例: フラグ読み出し時に undefined の場合は true 扱いとする（`flagOnOrDefaultTrue('WORKER_WC_COMMIT_V2')` のような実装 or 既存関数に個別例外）
     - 環境で `0/false` を与えた場合のみOFF。
2) 経路の一貫性点検
   - `WorkingCopyService.commitWorkingCopy()` が常に CP 経由となることを確認（V2経路が前提）。
   - `CommandProcessor` の `'commitWorkingCopy'` 分岐と V2 実装の戻り値 → API の `CommitResult` 変換を点検。
3) UI エラーハンドリング実装
   - `COMMIT_CONFLICT` の場合: 差分提示/再試行/取り消しの導線。
   - `NAME_CONFLICT`: サジェストされた `suggestedName` or `autoRenameTo` を提示し確定可能に。
4) テスト補強
   - ユニット: V2 正常/競合/名称衝突（auto-rename/エラー）の網羅。
   - 併走コミット（同一ノードへほぼ同時コミット）での `COMMIT_CONFLICT` 再現テスト。
   - E2E: UI からの一連の操作（作成→編集→コミット、競合解消）を追加。
5) ドキュメント更新
   - 既定ON・レガシー経路は後方互換のために残すがOFF運用のみ、を明記。

## 受け入れ基準（DoD）
- フラグ未設定で V2 経路が動作し、UIが競合/衝突を正しくガイドする。
- 競合再現テストで `COMMIT_CONFLICT` を安定的に検出→ユーザ操作で解消可能。
- 既存 E2E がグリーン、追加テストもグリーン。
- 主要ブラウザでパフォーマンス劣化が無い（P95 コミット時間の退行なし）。

## ロールバック手順
- 環境で `WORKER_WC_COMMIT_V2=0` を設定し再起動。
- 必要に応じて UI の競合ダイアログを一時無効化（feature flag またはルーティング非表示）。

## リスクと緩和
- UI 未対応によるUX低下 → 先にUI実装/リリース。ドキュメントで運用手順を提示。
- 大量コミット時のパフォーマンス → バッチ設計・測定を追加、`EntityLifecycle` 通知は非同期 best-effort。

## 作業粒度とPR方針
- PR1: フラグ既定ON（コード）+ Worker ユニットテスト更新
- PR2: UI 競合/名称衝突のUX
- PR3: E2E 追加と計測ログ

---

### 参考ファイル
- `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
- `packages/runtime-worker/worker/src/services/WorkingCopyService.ts`
- `packages/runtime-worker/worker/src/services/WorkingCopyTreeNodeOperations.ts`
- `packages/runtime-worker/worker/src/config/feature-flags.ts`

