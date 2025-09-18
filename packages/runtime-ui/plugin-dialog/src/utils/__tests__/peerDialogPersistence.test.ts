import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import {
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
