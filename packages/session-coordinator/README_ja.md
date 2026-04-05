# @hierarchidb/session-coordinator

最終更新: 2026-04-05

HierarchiDB のセッション調整パッケージ。BroadcastChannel を使用したタブ間セッション同期、ポーリングベースのセッション追跡、メモリストレージフォールバックを提供する。

## 主要な機能

- `createSessionBroadcastChannel` — BroadcastChannel ベースのタブ間セッション通知
- `createSessionTabId` — タブ固有のセッション ID 生成
- `createPollingTracker` — ポーリングベースのセッション追跡
- `createMemoryStorage` — メモリ内ストレージ（SessionStorage フォールバック）
- `resolveStorage` — SessionStorage / メモリストレージの自動選択

## 依存関係

外部依存なし。

## 関連パッケージ

- [`@hierarchidb/runtime-worker`](../runtime-worker/) — Worker ランタイム
- [`@hierarchidb/ui-session-coordinator`](../ui/session-coordinator/) — UI 側セッション調整

## ライセンス

MIT
