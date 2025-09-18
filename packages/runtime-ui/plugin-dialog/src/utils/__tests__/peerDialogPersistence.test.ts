import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  UIPersistence,
  getPeerDisplayMode,
  setPeerDisplayMode,
} from '../peerDialogPersistence.js';

class MockEntitiesDB {
  private rows = new Map<string, any>();

  async open(): Promise<void> {
    // no-op for mock
  }

  table() {
    return {
      get: async (id: string) => this.rows.get(id) ?? null,
      put: async (row: any) => { this.rows.set(row.nodeId, row); },
    };
  }
}

beforeEach(() => {
  globalThis.__HDB_PLUGIN_ENTITY_OVERRIDES__ = {
    folder: async () => {
      const db = new MockEntitiesDB();
      await db.open();
      return db;
    },
  };
});

afterEach(() => {
  delete globalThis.__HDB_PLUGIN_ENTITY_OVERRIDES__;
});

describe('peerDialogPersistence default provider', () => {
  it('stores and retrieves display mode for folder node type via override', async () => {
    const nodeId = 'peer-node-1';

    await setPeerDisplayMode('folder', nodeId, 'maximized');
    const mode = await getPeerDisplayMode('folder', nodeId);

    expect(mode).toBe('maximized');
  });
});


const fallbackRows = new Map<string, any>();

vi.mock('@hierarchidb/folder-plugin/worker/folderEntitiesDB', () => ({
  FolderEntitiesDB: class {
    async open() { /* no-op */ }
    table() {
      return {
        get: async (id: string) => fallbackRows.get(id) ?? null,
        put: async (row: any) => { fallbackRows.set(row.nodeId, row); },
      };
    }
  },
}));

describe('peerDialogPersistence EntitiesDB fallback', () => {
  beforeEach(() => {
    delete globalThis.__HDB_PLUGIN_ENTITY_OVERRIDES__;
    fallbackRows.clear();
    const registry = UIPersistence as unknown as { providers: Map<string, unknown>; dbCache: Map<string, unknown> };
    registry.providers.delete('folder');
    registry.dbCache.delete('folder');
  });

  afterEach(() => {
    const registry = UIPersistence as unknown as { providers: Map<string, unknown>; dbCache: Map<string, unknown> };
    registry.providers.delete('folder');
    registry.dbCache.delete('folder');
  });

  it('falls back to worker EntitiesDB export when no override is provided', async () => {
    const nodeId = 'fallback-node';
    await setPeerDisplayMode('folder', nodeId, 'fullscreen');
    const mode = await getPeerDisplayMode('folder', nodeId);
    expect(mode).toBe('fullscreen');
  });
});
