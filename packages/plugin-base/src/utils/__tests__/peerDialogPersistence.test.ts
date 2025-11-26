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

const peerStoreRows = new Map<string, MockRow>();

const peerStoreAdapter = {
  async get(nodeId: string) {
    const row = peerStoreRows.get(String(nodeId));
    if (!row) return undefined;
    return {
      nodeId: row.nodeId,
      dialogWindow: row.dialogWindow ?? null,
      dialogProgress: row.dialogProgress ?? null,
      updatedAt: Date.now(),
    } satisfies { nodeId: string; dialogWindow: unknown; dialogProgress: unknown; updatedAt: number };
  },
  async put(entity: { nodeId: string; dialogWindow?: unknown; dialogProgress?: unknown }) {
    peerStoreRows.set(String(entity.nodeId), {
      nodeId: String(entity.nodeId),
      dialogWindow: entity.dialogWindow ?? undefined,
      dialogProgress: entity.dialogProgress ?? undefined,
    });
  },
  async delete(nodeId: string) {
    peerStoreRows.delete(String(nodeId));
  },
};

vi.mock('@hierarchidb/runtime-worker', () => ({
  storeRegistry: {
    getPeer: (nodeType: string) => (nodeType === 'folder' ? peerStoreAdapter : undefined),
    registerPeer: () => {},
    getGroup: () => undefined,
    registerGroup: () => {},
    getRelations: () => undefined,
    registerRelations: () => {},
  },
}));

describe('peerDialogPersistence storeRegistry fallback', () => {
  beforeEach(() => {
    delete globalThis.__HDB_PLUGIN_ENTITY_OVERRIDES__;
    peerStoreRows.clear();
    const registry = UIPersistence as unknown as {
      providers: Map<string, unknown>;
      dbCache: Map<string, unknown>;
      setWarningExclusions: (nodeTypes: Iterable<string>) => void;
      getWarningExclusions: () => string[];
    };
    registry.providers.delete('folder');
    registry.dbCache.delete('folder');
    registry.setWarningExclusions(['folder']);
  });

  afterEach(() => {
    const registry = UIPersistence as unknown as {
      providers: Map<string, unknown>;
      dbCache: Map<string, unknown>;
      setWarningExclusions: (nodeTypes: Iterable<string>) => void;
      getWarningExclusions: () => string[];
    };
    registry.providers.delete('folder');
    registry.dbCache.delete('folder');
    registry.setWarningExclusions(['folder']);
  });

  it('falls back to runtime storeRegistry when no override is provided', async () => {
    const nodeId = 'fallback-node';
    await setPeerDisplayMode('folder', nodeId, 'full-screen');
    const mode = await getPeerDisplayMode('folder', nodeId);
    expect(mode).toBe('full-screen');
  });
});

describe('UIPersistence warning exclusion list', () => {
  type RegistryTestHandle = {
    providers: Map<string, unknown>;
    dbCache: Map<string, unknown>;
    setWarningExclusions: (nodeTypes: Iterable<string>) => void;
    addWarningExclusion: (nodeType: string) => void;
    removeWarningExclusion: (nodeType: string) => void;
    isWarningSuppressed: (nodeType: string) => boolean;
    getWarningExclusions: () => string[];
  };

  let registry: RegistryTestHandle;
  let previousExclusions: string[];

  beforeEach(() => {
    registry = UIPersistence as unknown as RegistryTestHandle;
    previousExclusions = registry.getWarningExclusions();
  });

  afterEach(() => {
    registry.setWarningExclusions(previousExclusions);
  });

  it('allows replacing the exclusion list', () => {
    registry.setWarningExclusions(['custom', 'folder']);
    expect(registry.getWarningExclusions().sort()).toEqual(['custom', 'folder']);
    expect(registry.isWarningSuppressed('custom')).toBe(true);
    expect(registry.isWarningSuppressed('folder')).toBe(true);
    expect(registry.isWarningSuppressed('other')).toBe(false);
  });

  it('supports adding and removing individual exclusions', () => {
    registry.setWarningExclusions([]);
    registry.addWarningExclusion('temp');
    expect(registry.isWarningSuppressed('temp')).toBe(true);
    registry.removeWarningExclusion('temp');
    expect(registry.isWarningSuppressed('temp')).toBe(false);
  });

  it('skips console warnings for excluded node types without a peer store', async () => {
    registry.setWarningExclusions(['ghost']);
    registry.providers.delete('ghost');
    registry.dbCache.delete('ghost');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await getPeerDisplayMode('ghost', 'ghost-node');

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
