import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { toNodeId } from '@hierarchidb/common-types';
import { FolderEntitiesDB } from '../folderEntitiesDB.ts';
import { createFolderPeerStoreDexie } from '../folderPeerStore.dexie.ts';
import type { FolderPeerData } from '../../common/types/types.ts';

describe('folder peer store dialogState persistence (Dexie)', () => {
  it('persists and retrieves dialogState snapshots', async () => {
    const db = new FolderEntitiesDB('folder-dialog-state-test');
    await db.open();

    const store = createFolderPeerStoreDexie(db);
    const nodeId = toNodeId('node-dialog');
    const data: FolderPeerData = { schemaVersion: 1, domain: {} };

    await store.put({
      nodeId,
      data,
      dialogProgress: { activeStepIndex: 2 },
      updatedAt: Date.now(),
    });

    const stored = await store.get(nodeId);
    expect(stored?.dialogProgress).toEqual({ activeStepIndex: 2 });
  });
});
