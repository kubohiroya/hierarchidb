# @hierarchidb/worker-api

最終更新: 2026-04-05

HierarchiDB の Worker API インターフェース定義パッケージ。メインスレッドから Comlink RPC 経由で Worker を呼び出すための `WorkerAPI` インターフェースを定義する。TreeNode CRUD、ビルドセッション制御、プラグイン操作、メモリ管理等のメソッドを含む。

## 主要な型

- `WorkerAPI` — Worker 側の全操作を定義するインターフェース（`ping`, TreeNode CRUD, ビルド制御等）
- `WorkerStorageAPI` — Worker 側ストレージ操作（`getItem`, `setItem`, `removeItem`）
- `YamlCoreDbReadOnlyInventoryResult` — on-demand CoreDB YAML inventoryのsanitized result。acceptedは件数だけ、rejectedはinvalid-record/error件数とredacted planner error、execution failureはstable codeだけを公開する。

`WorkerAPI.getYamlCoreDbReadOnlyInventory()`はactivation前diagnostic endpointであり、migrationまたはcanonical publicationを許可しない。実装はYAML本文、payload、journal value、digest、raw exception messageを公開してはならない。

## 依存関係

`@hierarchidb/core-types`, `@hierarchidb/build-api`, `@hierarchidb/tree-api`, `@hierarchidb/plugin-base`, `@hierarchidb/memory`, `@hierarchidb/yaml-api` 等。

## 関連パッケージ

- [`@hierarchidb/runtime-worker`](../runtime-worker/) — WorkerAPI の実装
- [`@hierarchidb/ui-worker-provider`](../ui/worker-provider/) — メインスレッド側の Worker クライアント

## ライセンス

MIT
