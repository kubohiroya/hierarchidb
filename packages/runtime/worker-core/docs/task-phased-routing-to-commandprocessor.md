vk:task id=phased-routing-cmdproc status=todo priority=P1 labels=worker,mutation,undo

# タスク: 段階ルーティング（create/update のみ CommandProcessor 経由）

## 背景 / 目的
- 実行経路を `CommandProcessor` に集約する第一歩として、影響の小さい `create/update` から切替えて Undo/Redo/監査の基盤を評価する。

## スコープ（範囲）
- 含む: `TreeMutationService.createNode / updateNode` の経路にフラグ分岐（`useCommandPath`）を追加し、ON 時は `processCommand` を呼び出す。
- 含まない: move/remove/duplicate/paste/import/restore の切替（次フェーズ）。

## 成果物
- `src/services/TreeMutationService.ts` の分岐実装と設定導線（env or static flag）。
- `CommandProcessor` に最小 `createNode/updateNode` ハンドラ（既存実装の委譲でも可）。
- ドキュメント更新（フラグの使い方）。

## 仕様詳細
- フラグ OFF（既定）: 現行の直 CoreDB 経路で動作。
- フラグ ON: `createEnvelope<'createNode'|'updateNode'>` で包んで `processCommand` へ。成功時のみ Undo スタックに積む。

## 実施手順
1. フラグ導入（`TreeMutationService` 内部または環境変数で制御）。
2. `create/update` の経路に分岐を追加。
3. `CommandProcessor.executeCommand` に同等の副作用を委譲（現状モックの補強）。
4. 影響範囲のテスト（作成/更新の正常・失敗）。

注記: 本タスクは「ドキュメント策定フェーズ」です。現時点ではコード実装を行いません（合意後に小さなPRへ分割して進めます）。

## 受け入れ基準
- フラグ OFF で完全非回帰。
- フラグ ON で `create/update` が成功し、Undo/Redo に記録（最小限）。

## テスト計画
- ユニット/統合: フラグ ON/OFF の両系統で `create/update` シナリオを検証。
- 監査: イベント履歴が記録される（サニタイズ済み）。

## 依存関係
- 進行中ブランチの結果に依存します。
  - CommandProcessor リファクタ計画: `docs/command-processor-refactor-plan.md`
  - Comlink/Worker 境界の型強化: `docs/task-comlink-typing-hardening.md`
  - 補足: Zod 導入（Envelope 限定）は並行可だが、最終スキーマは CP リファクタの決定に追従。

## リスクと緩和策
- リスク: 経路差異による副作用の差。
  - 緩和: フラグ OFF を既定とし、ON は限定テスト環境で評価。差分は段階的に吸収。
- リスク: 進行中ブランチと仕様衝突。
  - 緩和: 上記 2 ブランチの合流後に実装フェーズへ着手。ドラフトとドキュメントのみ先行。

## ロールアウト
- 検証後、特定環境でフラグ ON。安定後に既定を ON に引き上げ、最終的に分岐撤去。

## ロールバック
- フラグを OFF に戻す。

## 作業見積もり / 優先度
- 見積もり: 1–2 日
- 優先度: P1
