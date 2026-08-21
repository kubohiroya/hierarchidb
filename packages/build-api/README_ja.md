# @hierarchidb/build-api

最終更新: 2026-04-05

HierarchiDB ビルドシステムの API 型定義パッケージ。canonical build-sessionイベント型、セッション状態型、task summary、厳格なtask count契約を提供する。

## 主要な型

- `SessionStatusUpdatedEvent` — セッションフェーズ変更イベント
- `StageSnapshotUpdatedEvent` — ステージスナップショット更新イベント
- `TaskProgressUpdatedEvent` — タスク進捗更新イベント
- `HeartbeatEvent` — ハートビートイベント
- `BuildSessionState` / `BuildSessionStatus` — セッション状態・ステータス
- `BuildStatus` — task/session共通のcanonical status語彙
- `BuildTaskCountSummary` — canonical task count集計
- `ResourceUsage` — ビルドセッションのリソース使用量

aggregate progress event、互換adapter、status正規化fallbackは公開しない。canonical
event consumerは未知のstatusと不正な数値を境界で拒否する。

## 依存関係

`@hierarchidb/core-types` のみ。

## 関連パッケージ

- [`@hierarchidb/build`](../build/) — ビルドシステム基盤
- [`@hierarchidb/build-runtime-services`](../build-runtime-services/) — ランタイムイベント配信

## ライセンス

MIT
