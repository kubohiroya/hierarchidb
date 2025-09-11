# PLAN: WORKER_TX_ENABLED をデフォルトONにする

日付: 2025-09-10
対象フラグ: `WORKER_TX_ENABLED`
目的: すべてのミューテーションを Dexie トランザクションで包み、部分失敗時の原子性を確保する。

## 背景 / 現状
- 既定OFF。ON時は `CommandProcessor.executeCommand()` が `coreDB.runInTx('rw', ['nodes'], fn)` で包む。
- 複数テーブル（`trees`/`rootStates`/`tags`/`tagAssociations`）に跨るコマンドがあり、TX 対象配列が不十分だと Dexie がエラーを投げる可能性。

## 変更方針（デフォルトON化の要点）
1) 既定ON（環境 `0/false` でOFF）。
2) コマンドごとに触るテーブルを精査し、`runInTx` に正確な集合を渡す。
3) 例外時ロールバックの E2E を追加。

## 影響範囲 / 改修対象ディレクトリ
- Worker 本体
  - `packages/runtime-worker/worker/src/config/feature-flags.ts`
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`（TXラップとテーブル集合の見直し）
  - `packages/runtime-worker/worker/src/services/CoreDB.ts`（`runInTx` 補助の堅牢化）
  - `packages/runtime-worker/worker/src/services/TreeMutationService.ts`（直呼び箇所があれば Command 経由へ寄せる）
  - `packages/runtime-worker/worker/src/entity/*`（TXスコープと非同期 Best-effort の切り分け）
- テスト
  - `packages/runtime-worker/worker/src/services/__tests__/tx-wrapper.test.ts` の拡充

## 実装ステップ
1) フラグ既定ON
   - `feature-flags.ts` で `WORKER_TX_ENABLED` を既定 true に変更。
2) テーブル集合の精査/実装
   - `createNode`/`updateNode`/`moveNodes`/`moveToTrash`/`recoverFromTrash`/`commitWorkingCopy`/`duplicateNodes`/`pasteNodes`/`importNodes` を対象。
   - 触る可能性があるテーブルに応じて `['nodes', 'trees', 'rootStates', 'tags', 'tagAssociations']` を適切に選択。
   - 複数バッチ（bulkUpdate/bulkDelete）も同一TX内で行う。
3) CoreDB 側の堅牢化
   - `runInTx` で空配列時は非TX実行、テーブル名の妥当性チェックを追加。
4) 例外/ロールバック E2E
   - 更新途中で throw を注入→状態が完全に復旧することをassert。
5) 性能回帰チェック
   - 大量 move/duplicate/import で TX ON/OFF の P95 を比較。許容内であること。

## 受け入れ基準（DoD）
- フラグ未設定で全コマンドがTX内で実行、部分失敗時に整合性が保たれる。
- 既存/追加テストがグリーン。性能退行がベースライン比 ±5% 以内。

## ロールバック手順
- 環境で `WORKER_TX_ENABLED=0` を設定しOFF。

## リスクと緩和
- テーブル集合漏れ → 静的点検とユニット/ITで検出。失敗時は即ロールバックの設計。
- 長尺TXによる体感速度低下 → バッチ粒度の調整、UI には進捗インジケータ。

## 作業粒度とPR方針
- PR1: FEATURE_FLAGS 既定ON + `runInTx` 対象テーブル拡充（create/update/move）
- PR2: Trash/Recover/WC/Import/Paste のTX網羅 + ロールバックE2E
- PR3: 計測と最終調整

---

### 参考ファイル
- `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
- `packages/runtime-worker/worker/src/services/CoreDB.ts`
- `packages/runtime-worker/worker/src/services/__tests__/tx-wrapper.test.ts`

