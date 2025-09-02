import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeRegistry } from '@hierarchidb/runtime-worker-worker/entity/store-registry';
import { folderPeerStore, __clearFolderPeerStore } from '../worker/folderPeerStore';

describe('folder-plugin: peer store registration', () => {
  beforeEach(() => {
    vi.resetModules();
    __clearFolderPeerStore();
  });

  it('registers a PeerStore for nodeType "folder"', async () => {
    // Ensure clean state, then register
    if (storeRegistry.getPeer('folder')) {
      // No direct unregister API; overwrite registration for test isolation
      // @ts-expect-error internal overwrite for test
      (storeRegistry as any).peer?.delete?.('folder');
    }
    storeRegistry.registerPeer('folder', folderPeerStore);
    expect(storeRegistry.getPeer('folder')).toBeTruthy();
  });
});

