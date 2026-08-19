# @hierarchidb/runtime-worker

最終更新: 2026-08-20

HierarchiDB の Worker 側データベース・処理基盤パッケージ。`WorkerService` シングルトンが Worker 環境を初期化し、CoreDB（TreeNode CRUD）、各プラグインの FeatureStore / VectorTileStore、ビルドセッション復旧等を管理する。Comlink RPC 経由でメインスレッドの `WorkerAPI` と通信する。

## 主要な機能

- `WorkerService` — Worker 環境のシングルトン（プラグイン登録、CoreDB 初期化、ビルドセッション復旧）
- CoreDB — TreeNode の CRUD、Draft 管理、ペイロード永続化
- プラグイン別 FeatureStore / VectorTileStore の生成・管理
- Comlink RPC によるメインスレッドとの通信

## dormant YAML storage activation 契約

`@hierarchidb/runtime-worker/yaml-storage-activation` は、将来の YAML storage activation phase と fail-closed な公開判定を表す独立した pure subpath である。`WorkerService`、app bootstrap、database open、production の query / mutation route には接続しない。この subpath の import だけで migration が有効になったり、現行 legacy 動作が変わったりすることはない。

quiescing から initialization 完了までは legacy / canonical reader・writer の双方を非公開とし、upgrade commit 後の initialization 成功時だけ canonical access を公開する。target open が blocked の場合は同じ open request の再開だけを許可し、異なる request は terminal rejection とする。独立した YamlDB domain は全 phase で deny する。この dormant artifact は正規仕様に定める single activation release まで production entry point から到達不能のまま維持する。

## 依存関係

多数の `@hierarchidb/*` パッケージに依存（shape-store, location-store, route-store, styler-store, tree-api, build-api, chunk-store, tabular-store 等）。

## 関連パッケージ

- [`@hierarchidb/worker-api`](../worker-api/) — WorkerAPI インターフェース定義
- [`@hierarchidb/build`](../build/) — ビルドセッション基盤
- [`@hierarchidb/session-coordinator`](../session-coordinator/) — セッション調整

## ライセンス

MIT
