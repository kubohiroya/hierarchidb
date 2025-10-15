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
import { HierarchicalEntityHandler } from '@hierarchidb/plugin-loader-base-plugin';

export class MyEntityHandler extends HierarchicalEntityHandler<MyEntity> {
  protected table = myDexieTable;
  protected buildEntity(nodeId, entityId, data) { /* … */ }
}
```

## Working Copy ヘルパー
`WorkingCopyBase` はドラフト/コミット両方のペイロードを単一プロパティで表現する汎用型です。プラグイン固有の edit フローでは、次のようにドラフト初期化とコミット遷移を安全に扱えます。

```ts
import {
  createDraftWorkingCopyBase,
  markWorkingCopyUpdated,
  type WorkingCopyDraft,
} from '@hierarchidb/plugin-loader-base-plugin';

interface Entity {
  name: string;
  description?: string;
  version: number;
}

const wc = {
  ...createDraftWorkingCopyBase<Entity>({
    draft: { name: 'New node' },
    meta: {
      treeNodeId: 'node-1' as NodeId,
    },
  }),
  name: 'New node',
} satisfies WorkingCopyDraft<Entity>;

const updated = markWorkingCopyUpdated(wc, {
  description: 'Updated description',
});
console.log(updated.draft.description);
```

Working Copy はエンティティの一部（`Partial<Entity>`）のみを扱い、UI 固有の一時データは含めない想定で設計されている。

## PeerStore ヘルパー
`createPeerStoreNormalizer` はプラグイン固有のデフォルト値をマージするファクトリです。`schemaVersion` やメタデータの上書き漏れを防げます。

```ts
import { createPeerStoreNormalizer } from '@hierarchidb/plugin-loader-base-plugin';

const normalizePeerData = createPeerStoreNormalizer(() => ({
  schemaVersion: 1,
  domain: { flags: [] },
  metadata: { source: 'default' },
}));

// 未設定値は defaults が補完される
const payload = normalizePeerData({ metadata: { tags: ['foo'] } });
```

## 注意
- このパッケージは UI コンポーネントやワーカープラグイン定義を持ちません。
- ランタイムで直接有効化されるプラグインではなく、実装向けのユーティリティ/抽象です。
