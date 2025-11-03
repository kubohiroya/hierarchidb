import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPeerDisplayMode, setPeerDisplayMode, UIPersistence } from '../peerDialogPersistence.js';

type MockRow = { nodeId: string } & Record<string, unknown>;

class MockEntitiesDB {
  private rows = new Map<string, MockRow>();

  async open(): Promise<void> {
    // no-op for mock
  }

  table() {
    return {
      get: async (id: string) => this.rows.get(id) ?? null,
      put: async (row: MockRow) => {
        this.rows.set(row.nodeId, row);
      },
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

    await setPeerDisplayMode('folder', nodeId, 'maximize');
    const mode = await getPeerDisplayMode('folder', nodeId);

    expect(mode).toBe('maximize');
  });
});

const fallbackRows = new Map<string, MockRow>();

vi.mock('@hierarchidb/runtime-worker', () => ({
  PLUGIN_WORKER_MODULE_IDS: {
    folder: '@hierarchidb/folder-plugin/worker',
  },
  importPluginWorker: (id: string) => {
    if (id !== 'folder') {
      return Promise.reject(new Error(`Unhandled plugin id ${id}`));
    }
    return import('@hierarchidb/folder-plugin/worker');
  },
}));

vi.mock('@hierarchidb/folder-plugin/worker', () => ({
  loadFolderEntitiesDbModule: async () => ({
    FolderEntitiesDB: class {
      async open() {
        /* no-op */
      }
      table() {
        return {
          get: async (id: string) => fallbackRows.get(id) ?? null,
          put: async (row: MockRow) => {
            fallbackRows.set(row.nodeId, row);
          },
        };
      }
    },
  }),
}));

describe('peerDialogPersistence EntitiesDB fallback', () => {
  beforeEach(() => {
    delete globalThis.__HDB_PLUGIN_ENTITY_OVERRIDES__;
    fallbackRows.clear();
    const registry = UIPersistence as unknown as {
      providers: Map<string, unknown>;
      dbCache: Map<string, unknown>;
    };
    registry.providers.delete('folder');
    registry.dbCache.delete('folder');
  });

  afterEach(() => {
    const registry = UIPersistence as unknown as {
      providers: Map<string, unknown>;
      dbCache: Map<string, unknown>;
    };
    registry.providers.delete('folder');
    registry.dbCache.delete('folder');
  });

  it('falls back to worker EntitiesDB export when no override is provided', async () => {
    const nodeId = 'fallback-node';
    await setPeerDisplayMode('folder', nodeId, 'full-screen');
    const mode = await getPeerDisplayMode('folder', nodeId);
    expect(mode).toBe('full-screen');
  });
});
