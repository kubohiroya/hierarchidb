import { importPluginWorker, PLUGIN_WORKER_MODULE_IDS, type PluginWorkerId } from '@hierarchidb/runtime-shared-module-paths';

export type PeerDisplayMode = 'normal' | 'maximize' | 'full-screen';
export type PeerDialogPosition = { x: number; y: number };
export type PeerDialogSize = { width: number; height: number };

export interface PeerDialogPersistence {
  getDisplayMode(nodeId: string): Promise<PeerDisplayMode | null>;
  setDisplayMode(nodeId: string, mode: PeerDisplayMode): Promise<void>;
  getPosition(nodeId: string): Promise<PeerDialogPosition | null>;
  setPosition(nodeId: string, pos: PeerDialogPosition): Promise<void>;
  getSize(nodeId: string): Promise<PeerDialogSize | null>;
  setSize(nodeId: string, size: PeerDialogSize): Promise<void>;
  copyState?(fromNodeId: string, toNodeId: string): Promise<void>;
}

type PeerDialogRow = {
  nodeId: string;
  displayMode?: string;
  dialogPosition?: PeerDialogPosition;
  dialogSize?: PeerDialogSize;
  updatedAt?: number;
};

type PeerEntitiesTable = {
  get: (id: string) => Promise<PeerDialogRow | undefined>;
  put: (row: PeerDialogRow) => Promise<void>;
  delete?: (id: string) => Promise<void> | void;
};

type PeerEntitiesDBAdapter = {
  open?: () => Promise<void> | void;
  table: (name: string) => PeerEntitiesTable;
};

type EntitiesOverrideFactory =
  | PeerEntitiesDBAdapter
  | (() => PeerEntitiesDBAdapter | Promise<PeerEntitiesDBAdapter | undefined> | undefined)
  | (() => Promise<PeerEntitiesDBAdapter | undefined>);

type EntitiesOverrideRegistry = Record<string, EntitiesOverrideFactory>;

declare global {
  var __HDB_PLUGIN_ENTITY_OVERRIDES__: Record<string, unknown> | undefined;
}

const KNOWN_PLUGIN_WORKER_IDS = new Set<PluginWorkerId>(
  Object.keys(PLUGIN_WORKER_MODULE_IDS) as PluginWorkerId[],
);

function isPluginWorkerId(value: string): value is PluginWorkerId {
  return KNOWN_PLUGIN_WORKER_IDS.has(value as PluginWorkerId);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

class UIPersistenceRegistry {
  private providers = new Map<string, PeerDialogPersistence>();
  private dbCache = new Map<string, PeerEntitiesDBAdapter | null>();

  register(nodeType: string, provider: PeerDialogPersistence) {
    this.providers.set(nodeType, provider);
  }

  get(nodeType: string): PeerDialogPersistence {
    if (!nodeType || typeof nodeType !== 'string') return this.noopProvider();
    return this.providers.get(nodeType) || this.createDefaultProvider(nodeType);
  }

  private noopProvider(): PeerDialogPersistence {
    return {
      async getDisplayMode() { return null; },
      async setDisplayMode() { /* no-op */ },
      async getPosition() { return null; },
      async setPosition() { /* no-op */ },
      async getSize() { return null; },
      async setSize() { /* no-op */ },
      async copyState() { /* no-op */ },
    };
  }

  private createDefaultProvider(nodeType: string): PeerDialogPersistence {
    const ensureDB = async () => {
      if (this.dbCache.has(nodeType)) return this.dbCache.get(nodeType);
      if (!nodeType || typeof nodeType !== 'string') { this.dbCache.set(nodeType, null); return null; }

      const overrides = typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & {
        __HDB_PLUGIN_ENTITY_OVERRIDES__?: EntitiesOverrideRegistry;
      }) : undefined;
      const overrideFactory = overrides?.__HDB_PLUGIN_ENTITY_OVERRIDES__?.[nodeType];
      if (overrideFactory) {
        const instance = typeof overrideFactory === 'function'
          ? await Promise.resolve(overrideFactory())
          : overrideFactory;
        if (instance) {
          this.dbCache.set(nodeType, instance);
          return instance;
        }
        this.dbCache.set(nodeType, null);
        return null;
      }

      const className = `${capitalize(nodeType)}EntitiesDB`;
      let lastError: unknown = null;

      const instantiateFromModule = async (module: Record<string, unknown>): Promise<PeerEntitiesDBAdapter | null> => {
        const Ctor = module?.[className] as (new () => { open?: () => Promise<void> | void; table: (name: string) => PeerEntitiesTable });
        if (!Ctor) {
          lastError = new Error(`Export ${className} missing`);
          return null;
        }
        const db = new Ctor();
        await db.open?.();
        const adapter: PeerEntitiesDBAdapter = {
          table: (name: string): PeerEntitiesTable => {
            const tbl = db.table(name);
            return {
              get: (id: string) => tbl.get(id),
              put: (row: PeerDialogRow) => tbl.put(row),
            };
          },
        };
        this.dbCache.set(nodeType, adapter);
        return adapter;
      };

      if (isPluginWorkerId(nodeType)) {
        try {
          const factoryModule = await importPluginWorker(nodeType as PluginWorkerId);
          const loadFnName = `load${capitalize(nodeType)}EntitiesDbModule`;
          const loadFn = (factoryModule as Record<string, unknown>)[loadFnName];
          if (typeof loadFn === 'function') {
            const entitiesModule = await (loadFn as () => Promise<Record<string, unknown>>)();
            const adapter = await instantiateFromModule(entitiesModule ?? {});
            if (adapter) {
              return adapter;
            }
          } else {
            lastError = new Error(`Function ${loadFnName} is not exported from worker-factory`);
          }
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        console.warn('[UIPersistenceRegistry] Failed to load EntitiesDB for', nodeType, lastError);
      }
      this.dbCache.set(nodeType, null);
      return null;
    };

    const withRow = async (nodeId: string, updater: (row: PeerDialogRow) => void | Promise<void>) => {
      const db = await ensureDB(); if (!db) return;
      const tbl = db.table('peerEntities');
      const row = (await tbl.get(nodeId)) ?? { nodeId };
      await Promise.resolve(updater(row));
      row.updatedAt = Date.now();
      await tbl.put(row);
    };

    return {
      getDisplayMode: async (nodeId) => {
        const db = await ensureDB(); if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        const raw = row?.displayMode ?? null;
        if (raw === 'normal' || raw === 'maximize' || raw === 'full-screen') {
          return raw;
        }
        if (raw === 'standard' || raw === 'maximized' || raw === 'fullscreen') {
          const migrated = raw === 'standard' ? 'normal' : raw === 'maximized' ? 'maximize' : 'full-screen';
          await db.table('peerEntities').put({
            ...(row ?? { nodeId }),
            nodeId,
            displayMode: migrated,
            updatedAt: Date.now(),
          });
          return migrated;
        }
        return null;
      },
      setDisplayMode: async (nodeId, mode) => withRow(nodeId, (r) => { r.displayMode = mode; }),
      getPosition: async (nodeId) => {
        const db = await ensureDB(); if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        return (row?.dialogPosition as PeerDialogPosition) ?? null;
      },
      setPosition: async (nodeId, pos) => withRow(nodeId, (r) => { r.dialogPosition = pos; }),
      getSize: async (nodeId) => {
        const db = await ensureDB(); if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        return (row?.dialogSize as PeerDialogSize) ?? null;
      },
      setSize: async (nodeId, size) => withRow(nodeId, (r) => { r.dialogSize = size; }),
      copyState: async (fromId, toId) => {
        const db = await ensureDB(); if (!db) return;
        const tbl = db.table('peerEntities');
        const src = await tbl.get(fromId); if (!src) return;
        const dst = (await tbl.get(toId)) || { nodeId: toId };
        if (src.displayMode) {
          const raw = src.displayMode;
          const normalized = raw === 'normal' || raw === 'maximize' || raw === 'full-screen'
            ? raw
            : raw === 'standard'
              ? 'normal'
              : raw === 'maximized'
                ? 'maximize'
                : raw === 'fullscreen'
                  ? 'full-screen'
                  : null;
          if (normalized) {
            dst.displayMode = normalized;
          }
        }
        dst.dialogPosition = src.dialogPosition ?? dst.dialogPosition;
        dst.dialogSize = src.dialogSize ?? dst.dialogSize;
        dst.updatedAt = Date.now();
        await tbl.put(dst);
      },
    };
  }
}

export const UIPersistence = new UIPersistenceRegistry();

// Convenience wrappers (default provider)
export const getPeerDisplayMode = (nodeType: string, nodeId: string) => UIPersistence.get(nodeType).getDisplayMode(nodeId);
export const setPeerDisplayMode = (nodeType: string, nodeId: string, mode: PeerDisplayMode) => UIPersistence.get(nodeType).setDisplayMode(nodeId, mode);
export const getPeerDialogPosition = (nodeType: string, nodeId: string) => UIPersistence.get(nodeType).getPosition(nodeId);
export const setPeerDialogPosition = (nodeType: string, nodeId: string, pos: PeerDialogPosition) => UIPersistence.get(nodeType).setPosition(nodeId, pos);
export const getPeerDialogSize = (nodeType: string, nodeId: string) => UIPersistence.get(nodeType).getSize(nodeId);
export const setPeerDialogSize = (nodeType: string, nodeId: string, size: PeerDialogSize) => UIPersistence.get(nodeType).setSize(nodeId, size);
