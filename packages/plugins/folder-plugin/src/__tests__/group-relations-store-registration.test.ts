import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeRegistry } from '@hierarchidb/runtime-worker';
import { __clearFolderGroupStore, folderGroupStore } from '../worker/folderGroupStore.js';
import { __clearFolderRelationStore, folderRelationStore } from '../worker/folderRelationStore.js';

describe('folder-plugin: group/relations store registration', () => {
  beforeEach(() => {
    vi.resetModules();
    __clearFolderGroupStore();
    __clearFolderRelationStore();
  });

  it('registers Group and Relations stores for nodeType "folder"', async () => {
    // clean state
    // @ts-expect-error internal cleanup for test isolation
    (storeRegistry as any).group?.delete?.('folder');
    // @ts-expect-error internal cleanup for test isolation
    (storeRegistry as any).rel?.delete?.('folder');

    storeRegistry.registerGroup('folder', folderGroupStore);
    storeRegistry.registerRelations('folder', folderRelationStore);

    expect(storeRegistry.getGroup('folder')).toBeTruthy();
    expect(storeRegistry.getRelations('folder')).toBeTruthy();
  });
});
