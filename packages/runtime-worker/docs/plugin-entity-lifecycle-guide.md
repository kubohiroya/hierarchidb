# Plugin Entity Lifecycle Guide (NodePayload Edition)

このガイドは、TreeNode に統合された Peer payload/draft をプラグイン側でどのように扱うかを説明する。2025-11 以降、PeerEntity は Dexie の `peerEntities` テーブルではなく `TreeNode<TPayload>` に直接格納され、runtime-worker が提供する `createNodePayloadPeerStore()` を通じてアクセスする。

## 基本ポリシー

- **TreeNode<TPayload>**: `TreeNode` が `payload`（canonical）と `draft`（working copy）を持つ。payload/draft は `NodePayloadEnvelope<T>` として保存され、UI/Worker 双方が共通の構造を参照する。
- **PeerStore 登録**: プラグインは Worker 初期化時に `createNodePayloadPeerStore()` で正規化関数を登録する。`storeRegistry.registerPeer(nodeType, createNodePayloadPeerStore({ normalize }))` が唯一の導線。
- **Group/Relation**: 1:N / N:N データが必要な場合のみ Dexie テーブルを維持する。Peer データは TreeNode に集約する。
- **Lifecycle Hooks**: runtime-worker は createWorkingCopy / commitWorkingCopy / duplicate / paste / import 等のコマンドで `storeRegistry` に登録された PeerStore を呼び出し、payload/draft を自動的にコピー／削除する。プラグイン側で追加の Dexie 操作を行う必要はない。

## 実装ステップ

### 1) payload 型と normalizer を定義

```ts
// plugins/foo-plugin/src/_obsolate_common/types/FooPeerData.ts
export interface FooPeerData {
  schemaVersion: 1;
  settings?: { theme?: 'light' | 'dark' };
  metadata?: Record<string, unknown>;
}

export const normalizeFooPeerData = (data?: FooPeerData | null): FooPeerData => ({
  schemaVersion: 1,
  settings: data?.settings ?? { theme: 'light' },
  metadata: data?.metadata ?? {},
});
```

### 2) createNodePayloadPeerStore で登録

```ts
// plugins/foo-plugin/src/worker/factory/registerFooWorkerStores.ts
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import { normalizeFooPeerData } from '../../_obsolate_common/types/FooPeerData';

export async function registerFooWorkerStores() {
  const { storeRegistry } = await import('@hierarchidb/runtime-worker');
  if (!storeRegistry.getPeer('foo')) {
    storeRegistry.registerPeer(
      'foo',
      createNodePayloadPeerStore({
        normalize: (data) => normalizeFooPeerData(data ?? undefined),
      })
    );
  }
}

registerFooWorkerStores().catch(() => {});
```

`createNodePayloadPeerStore()` は内部で `CoreDB.getSingleton()` を用い、`TreeNode.payload` / `TreeNode.draft` を直接読み書きする。normalize 関数は undefined/null 入力を考慮して `schemaVersion` を必ず返すこと。

### 3) UI / Worker からの利用

- **Working Copy 更新**: `updateWorkingCopy` に payload/draft の diff を渡すだけで CoreDB が更新される。プラグイン側で Dexie へ書き込む必要はない。
- **Dialog state**: `PeerEntity.dialogWindow/dialogProgress` は `createNodePayloadPeerStore()` が TreeNode の envelope に含める。UI から `peerDialogPersistence` を利用する場合でも、裏側は TreeNode payload を介して保存される。
- **Lifecycle Hooks**: commit/discard/duplicate/paste/import は runtime-worker が `PeerEntityHandler` を通じて TreeNode payload をコピーする。`bulkUpsert` を実装することで大規模操作の効率を向上できる（大量ノードで `store.bulkUpsert()` が呼ばれる）。

## CoreDB 側の動作

- `createWorkingCopy` は対象ノードの payload を読み込み、`TreeNode.draft` として複製する。UI が Stepper で編集した値は `draft` へ記録される。
- `commitWorkingCopy` は WC ノードの payload をターゲットノードへアップサートし、WC 側の payload/draft をクリアする。同時に `syncPeerDataFromNode()` が登録済み PeerStore を更新するため、UI で subscribe している場合でも常に最新状態を得られる。
- `deletePeerEntitiesForNodes()` は `storeRegistry` の PeerStore を呼び出す（TreeNode payload を null にする）。Legacy override が登録されていない限り Dexie へは触れない。

## Group / Relation を使う場合

Peer payload 以外に 1:N / N:N データを保持する必要があるプラグイン（location/shape 等）は引き続き Dexie ベースの Group/Relation store を登録する。

```ts
registry.registerGroup('location', createLocationGroupStoreDexie(db));
registry.registerRelations('location', createLocationRelationStoreDexie(db));
```

TreeNode payload とは別のテーブルを扱う際も、Peer payload の normalize は NodePayload に集約する点に注意。

## 既知のベストプラクティス

- **schemaVersion**: すべての payload に `schemaVersion` を含め、将来の migrate/gc を容易にする。
- **Undefined クリア**: normalize は invalid 値を undefined/null へ落とし、UI が不要な diff を生成しないようにする。
- **localStorage などの補助記憶**: Basemap の `zxy` のようにブラウザ局所に保持する値は payload には含めず、UI 側で fallback → payload commit の順に適用する。
- **Testing**: PeerStore が NodePayload を返すため、unit test で `createNodePayloadPeerStore()` の normalize を直接呼び出すとミスを早期検知できる。

Dexie ベースの手順は legacy として `docs/deprecated/` に移動済み。新規プラグインは本ガイドの NodePayload 流儀に従うこと。
