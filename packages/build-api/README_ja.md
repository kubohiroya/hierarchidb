# @hierarchidb/build-api

最終更新: 2026-04-05

HierarchiDB ビルドシステムの API 型定義パッケージ。ビルドセッションのイベント型（`SessionStatusUpdatedEvent`, `TaskProgressUpdatedEvent`, `StageSnapshotUpdatedEvent`, `HeartbeatEvent`）、セッション状態型、進捗ペイロード型、タスクステータス正規化ユーティリティを提供する。

## 主要な型

- `SessionStatusUpdatedEvent` — セッションフェーズ変更イベント
- `StageSnapshotUpdatedEvent` — ステージスナップショット更新イベント
- `TaskProgressUpdatedEvent` — タスク進捗更新イベント
- `HeartbeatEvent` — ハートビートイベント
- `BuildSessionState` / `BuildSessionStatus` — セッション状態・ステータス
- `BuildProgressPayload` / `ResourceUsage` — 進捗ペイロード・リソース使用量
- `normalizeProgressPhase` / `mapProgressPhaseToBuildStatus` — ステータス正規化

## 依存関係

`@hierarchidb/core-types` のみ。

## 関連パッケージ

- [`@hierarchidb/build`](../build/) — ビルドシステム基盤
- [`@hierarchidb/build-runtime-services`](../build-runtime-services/) — ランタイムイベント配信

## ライセンス

MIT
