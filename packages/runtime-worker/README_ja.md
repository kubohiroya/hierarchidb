# @hierarchidb/runtime-worker

最終更新: 2026-04-05

HierarchiDB の Worker 側データベース・処理基盤パッケージ。`WorkerService` シングルトンが Worker 環境を初期化し、CoreDB（TreeNode CRUD）、各プラグインの FeatureStore / VectorTileStore、ビルドセッション復旧等を管理する。Comlink RPC 経由でメインスレッドの `WorkerAPI` と通信する。

## 主要な機能

- `WorkerService` — Worker 環境のシングルトン（プラグイン登録、CoreDB 初期化、ビルドセッション復旧）
- CoreDB — TreeNode の CRUD、Draft 管理、ペイロード永続化
- プラグイン別 FeatureStore / VectorTileStore の生成・管理
- Comlink RPC によるメインスレッドとの通信

## 依存関係

多数の `@hierarchidb/*` パッケージに依存（shape-store, location-store, route-store, styler-store, tree-api, build-api, chunk-store, tabular-store 等）。

## 関連パッケージ

- [`@hierarchidb/worker-api`](../worker-api/) — WorkerAPI インターフェース定義
- [`@hierarchidb/build`](../build/) — ビルドセッション基盤
- [`@hierarchidb/session-coordinator`](../session-coordinator/) — セッション調整

## ライセンス

MIT
