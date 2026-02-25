# Shape Transform メタデータ整合化（(0)〜(3) 事前準備）

## 目的
Transform ステージのタスク情報とキャッシュ情報のメタデータを共通化し、
`message` / `tolerance` 直接参照を将来廃止する前提で、
`transformCacheMeta` と `buildTasks` の `metadata` を同一ソースに揃える。

## 対象スコープ
- `ShapeTransform` タスクの最終結果（Completed/Failed/Skipped）メタデータを一元化
- `transformCacheMeta` と `buildTasks` の `metadata` 同期方針の統一
- UI のタスクメッセージ表示（ツールチップ文言）を `metadata` を前提に再構築
- `tolerance` と `exhibited message` の段階的移行（本実装では削除しない）

## ステップ (0)〜(3)（廃止前段階）

### (0) metadata 型の整備
- `packages/shape-api` に transform 用のメタデータ型を追加（`status / extractionRatio / effectiveTolerance / retryAttempt`）
- `ShapeTransformCache` と `EphemeralTransformCache*` の metadata 領域へ型を適用（required にはしない）

### (1) buildTasks 側（タスク進捗）
- `vt-orchestrator` の transform handler が返却する `metadata` に
  `status / extractionRatio / effectiveTolerance / retryAttempt` を必ず反映
- `vt-orchestrator`→`shape-plugin` の task summary 変換時に `message` に依存しない `metadata` を活用
- `mapBuildTaskToQueueTask` で `metadata` を保持（復元/サマリー時の `-` 表示解消）
- UI の `TaskItemCard` で表示文言を `metadata` を含めて構築

### (2) transformCache 側の準備
- `transformCache` テーブル自体の `tolerance` 既存プロパティは保持（廃止は未実施）
- 代わりに `metadata` を追加し、将来移行を見据えて `effectiveTolerance` を保存

### (3) transformCacheMeta 側の拡張
- `transformCacheMeta` へ `metadata` を追加
- `transformCache` への書き込み時に、cache本体更新と同一内容（task metadata）を保持できるよう紐づける
- 失敗/スキップ時の `transformCacheMeta` 記録については、
  既存 `tolerance` 構造を残したまま、`metadata` で最終状態を保持する準備を進める

## 実施方針（本リリース）
1. 型追加と変数名・ヘルパー追加を最小差分で入れる
2. transform 成功パスで `metadata` を `transformCache` に同時保存
3. compareTaskOrder と task seed mapping の `metadata` 引き継ぎを修正
4. UI の transform メッセージ組み立てを `effectiveTolerance/retryAttempt` から解決
5. 文字列化ロジックの保守（`-` 回避を最小化）

## 注意
- `message` と `tolerance` の削除自体は実施しない（本フェーズ）
- `Record<string, unknown>` で保持した形状を維持しつつ、段階的に厳密化を進める
