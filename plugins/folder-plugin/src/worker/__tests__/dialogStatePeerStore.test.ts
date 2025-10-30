import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { toNodeId, type MultiStepDialogState } from '@hierarchidb/common-types';
import { FolderEntitiesDB } from '../folderEntitiesDB.ts';
import { createFolderPeerStoreDexie } from '../folderPeerStore.dexie.ts';

describe('folder peer store dialogState persistence (Dexie)', () => {
  it('persists and retrieves dialogState snapshots', async () => {
    const db = new FolderEntitiesDB('folder-dialog-state-test');
    await db.open();

    const store = createFolderPeerStoreDexie(db);
    const snapshot: MultiStepDialogState = {
      nodeId: toNodeId('node-dialog'),
      activeStepIndex: 0,
      steps: [
        { id: 'basic', title: 'Basic', enabled: true, completed: false, error: null },
      ],
      canProceedNext: true,
      canGoBack: false,
      canSave: false,
      canStartBatch: false,
      validationErrors: undefined,
      updatedAt: Date.now(),
      metadata: { title: 'Create Folder', subtitle: 'Draft', committableStepIndices: [0] },
    };

    await store.put({ nodeId: toNodeId('node-dialog'), dialogState: snapshot });

    const stored = await store.get(toNodeId('node-dialog'));
    expect(stored?.dialogState).toMatchObject({
      nodeId: 'node-dialog',
      activeStepIndex: 0,
      steps: [{ id: 'basic' }],
    });
  });
});
