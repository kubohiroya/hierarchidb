# @hierarchidb/build-runtime-services

最終更新: 2026-04-05

HierarchiDB ビルドシステムのランタイムサービスパッケージ。Worker→UI のイベント配信（`UnconditionalEventStreamer`）、タスク進捗イベント発行（`emitTaskProgressUpdated`）、ステージチェックポイント実行（`runWithStageCheckpoint`）、メモリスナップショット取得を提供する。

## 主要な機能

- `UnconditionalEventStreamer` — Worker→UI イベントの無条件配信（subscribe/emit パターン）
- `emitTaskProgressUpdated` — タスク進捗更新イベントの発行
- `emitHeartbeat` — ハートビートイベントの発行
- `runWithStageCheckpoint` — ステージ実行のチェックポイント付きラッパー
- `createMemorySnapshot` — メモリ使用量スナップショットの取得

## 依存関係

`@hierarchidb/build`, `@hierarchidb/build-api`, `@hierarchidb/core-types`, `@hierarchidb/download`

## 関連パッケージ

- [`@hierarchidb/build`](../build/) — ビルドシステム基盤
- [`@hierarchidb/build-api`](../build-api/) — イベント型定義

## ライセンス

MIT
