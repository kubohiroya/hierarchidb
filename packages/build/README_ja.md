# @hierarchidb/build

最終更新: 2026-08-21

HierarchiDB のビルドシステム基盤パッケージ。`BuildService`（チャンク並列処理）、`AbstractBuildSession`（セッションライフサイクル）、`BaseBuildSessionManager`（セッション管理）、レーンセマフォを提供する。shape-plugin / location-plugin / route-plugin のバッチ処理がこのパッケージに依存する。

## 主要な機能

- `BuildService` — 非同期イテレータのチャンク並列マッピング
- `AbstractBuildSession` — ビルドセッションの抽象基底クラス（状態管理、payloadなしのsession update通知、中断制御）
- `BaseBuildSessionManager` — セッション登録とsession update hookの管理
- `LaneSemaphoreRegistry` — メソッド別並列数制御（レーンポリシー）

canonical Worker→UIイベントは、managerがsession stateとpluginのcanonical event
sourceを再読込した後、`@hierarchidb/build-runtime-services`が生成する。session層は
aggregate progress eventを生成・転送しない。

legacy progress adapterのexportは後続Issueで削除するまで互換用としてのみ残し、
session/managerの通知経路からは使用しない。

## 依存関係

`@hierarchidb/build-api`, `@hierarchidb/core-types`, `@hierarchidb/download`

## 関連パッケージ

- [`@hierarchidb/build-api`](../build-api/) — ビルドイベント・ステータス型定義
- [`@hierarchidb/build-runtime-services`](../build-runtime-services/) — ランタイムイベント配信
- [`@hierarchidb/build-session-ports`](../build-session-ports/) — セッション制御ポート

## ライセンス

MIT
