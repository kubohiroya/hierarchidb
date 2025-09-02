# Plugin Entity Lifecycle Guide (A-Plan)

This guide explains how plugin authors should persist Peer entities using the A‑plan:

- Each plugin owns a dedicated Dexie DB (e.g. `<plugin>-entities`).
- Table names are common across plugins (e.g. `peerEntities`).
- The runtime worker resolves the proper store via `storeRegistry` using `nodeType`.
- Command lifecycle (commit/paste/import/duplicate) notifies stores behind a feature flag.

## 1) Define a Dexie DB for your plugin

```ts
import Dexie, { Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-type';

export interface MyPeerEntity {
  nodeId: NodeId;
  data: unknown; // your domain data
  updatedAt: number;
}

export class MyPluginDB extends Dexie {
  peerEntities!: Table<MyPeerEntity, NodeId>;

  constructor() {
    super('myplugin-entities');
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
  }
}
```

## 2) Implement a PeerStore

```ts
import type { NodeId } from '@hierarchidb/common-type';
import type { PeerStore, PeerEntity } from '@hierarchidb/runtime-worker/entity/store';

export function createPeerStore(db: MyPluginDB): PeerStore<any> {
  return {
    async get(id: NodeId) {
      return db.peerEntities.get(id) as any;
    },
    async put(e: PeerEntity) {
      await db.peerEntities.put(e as any);
    },
    async delete(id: NodeId) {
      await db.peerEntities.delete(id);
    },
    async bulkUpsert(entities: PeerEntity[]) {
      await db.peerEntities.bulkPut(entities as any);
    },
  };
}
```

`bulkUpsert` is optional but recommended for performance on large duplicate/import operations.

## 3) Register the store

Register your `PeerStore` for the plugin's `nodeType` during plugin initialization (Worker side):

```ts
import { storeRegistry } from '@hierarchidb/runtime-worker/entity/store-registry';

export function registerStores(db: MyPluginDB) {
  storeRegistry.registerPeer('my-node-type', createPeerStore(db));
}
```

## 4) Runtime behavior

- When `WORKER_ENTITY_UNIFIED=1`, the worker will:
  - On commit (WC→target): upsert Peer to target and delete WC Peer.
  - On paste/import/duplicate: copy Peer according to the old→new NodeId mapping.
  - If your store exposes `bulkUpsert`, it will be used automatically for efficiency.

## 5) Notes

- Transactions: Command boundary transactions apply to CoreDB only. Plugin DB writes are best‑effort and should be idempotent.
- Idempotency: Ensure repeated `put/bulkPut` calls are safe; include `updatedAt`.
- Versioning/Migrations: Manage your plugin DB schema versions independently of CoreDB.

## 6) Performance: bulk/chunk patterns

- Prefer `bulkUpsert` for Peer/Group/Relations to minimize round‑trips.
- The runtime will detect `store.bulkUpsert` and pass an array of entities; otherwise it falls back to sequential `put` calls.
- For Group/Relations, implement `bulkUpsert` in your plugin stores to handle hundreds/thousands of entities per call. If needed, chunk inside your store by 1× `PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE`.
- Example (Dexie):

```ts
async function bulkUpsert(entities: PeerEntity[]) {
  await db.peerEntities.bulkPut(entities as any);
}
```

Tip: Keep entities small and avoid denormalized UI fields (name/description) — those live on TreeNode.
