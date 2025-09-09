import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { FolderEntitiesDB } from '../worker/folderEntitiesDB';
import { createFolderPeerStoreDexie } from '../worker/folderPeerStore.dexie';

describe('folder-plugin: PeerStore Dexie', () => {
  let db: FolderEntitiesDB;

  beforeEach(async () => {
    db = new FolderEntitiesDB('folder-plugin-entities-test');
    await db.open();
    // Clear tables
    await db.peerEntities.clear();
  });

  it('put/get/delete and bulkUpsert', async () => {
    const store = createFolderPeerStoreDexie(db);

    const n1 = 'n1' as NodeId;
    const n2 = 'n2' as NodeId;

    // put + get
    await store.put({ nodeId: n1, data: { v: 1 } });
    const p1 = await store.get(n1);
    expect(p1?.data?.v).toBe(1);

    // bulkUpsert
    await store.bulkUpsert([
      { nodeId: n1, data: { v: 2 } },
      { nodeId: n2, data: { v: 3 } },
    ] as any);

    const p1b = await store.get(n1);
    const p2 = await store.get(n2);
    expect(p1b?.data?.v).toBe(2);
    expect(p2?.data?.v).toBe(3);

    // delete
    await store.delete(n1);
    const gone = await store.get(n1);
    expect(gone).toBeUndefined();
  });
});

