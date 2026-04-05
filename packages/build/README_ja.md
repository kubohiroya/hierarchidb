# @hierarchidb/build

最終更新: 2026-04-05

HierarchiDB のビルドシステム基盤パッケージ。`BuildService`（チャンク並列処理）、`AbstractBuildSession`（セッションライフサイクル）、`BaseBuildSessionManager`（セッション管理）、レーンセマフォ、進捗アダプタ等を提供する。shape-plugin / location-plugin / route-plugin のバッチ処理がこのパッケージに依存する。

## 主要な機能

- `BuildService` — 非同期イテレータのチャンク並列マッピング
- `AbstractBuildSession` — ビルドセッションの抽象基底クラス（状態管理、進捗追跡、中断制御）
- `BaseBuildSessionManager` — セッションの登録・進捗・ステータス変更のフック管理
- `LaneSemaphoreRegistry` — メソッド別並列数制御（レーンポリシー）
- `useBuildProgress` / `useBuildSessionTiming` — React フック（進捗表示・タイミング計算）
- 進捗アダプタ（`progressEventToUnified`, `createAdapterFromProgressSubscribe`）

## 依存関係

`@hierarchidb/build-api`, `@hierarchidb/core-types`, `@hierarchidb/download`

## 関連パッケージ

- [`@hierarchidb/build-api`](../build-api/) — ビルドイベント・ステータス型定義
- [`@hierarchidb/build-runtime-services`](../build-runtime-services/) — ランタイムイベント配信
- [`@hierarchidb/build-session-ports`](../build-session-ports/) — セッション制御ポート

## ライセンス

MIT
