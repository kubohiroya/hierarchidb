@hierarchidb/base-plugin
=======================

このパッケージは各ノードタイプ実装から再利用される「共通基盤」です。UI には表示されず、エンティティ操作や階層処理の抽象を提供します。

## 実装サマリ（2025-09-09）
- nodeType: `base`（非表示）
- 主要クラス:
  - `BaseEntityHandler<TEntity, TCreate, TSearch>`
    - 共通 CRUD（create/update/delete/get/list/paginate/search）
    - ライフサイクルフック（before/after create/update/delete）
    - バッチ操作（bulkAdd/更新/削除）
  - `HierarchicalEntityHandler<TEntity>`
    - 階層操作（祖先/子孫/兄弟/ルート/サブツリー/移動/削除）
    - `depth`/`path`/`childCount` 等の補助
- 提供型: `BaseSearchCriteria`, `PaginatedResult<T>`, `OperationResult<T>`, `EntityLifecycleHooks<T>`
- 定義: `BasePluginDefinition`（UI 非表示: create/menu 両方で非掲載）

## 利用例
フォルダ、ロケーションなどのプラグインで、各エンティティ固有の `EntityHandler` を実装する際の基底として継承します。

```ts
import { HierarchicalEntityHandler } from '@hierarchidb/base-plugin';

export class MyEntityHandler extends HierarchicalEntityHandler<MyEntity> {
  protected table = myDexieTable;
  protected buildEntity(nodeId, entityId, data) { /* … */ }
}
```

## 注意
- このパッケージは UI コンポーネントやワーカープラグイン定義を持ちません。
- ランタイムで直接有効化されるプラグインではなく、実装向けのユーティリティ/抽象です。

