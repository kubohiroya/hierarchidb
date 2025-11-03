import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';

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

type LegacyDisplayMode = 'standard' | 'maximized' | 'fullscreen';

type PeerDialogRow = {
  nodeId: string;
  displayMode?: PeerDisplayMode | LegacyDisplayMode;
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

const VALID_DISPLAY_MODES: PeerDisplayMode[] = ['normal', 'maximize', 'full-screen'];

type StoreRegistryShim = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
};
let storeRegistryPromise: Promise<StoreRegistryShim | null> | null = null;

async function resolveStoreRegistry(): Promise<StoreRegistryShim | null> {
  if (!storeRegistryPromise) {
    storeRegistryPromise = (async () => {
      try {
        const mod = await import('@hierarchidb/runtime-worker');
        if (mod && typeof mod === 'object' && 'storeRegistry' in mod) {
          const registry = (mod as { storeRegistry?: StoreRegistryShim }).storeRegistry;
          if (registry) return registry;
        }
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.debug('[UIPersistenceRegistry] runtime-worker storeRegistry unavailable', error);
        }
      }
      return null;
    })();
  }
  return storeRegistryPromise;
}

function normalizeDisplayMode(
  value: string | undefined,
  fallback: PeerDisplayMode | undefined
): PeerDisplayMode | undefined {
  if (value && VALID_DISPLAY_MODES.includes(value as PeerDisplayMode)) {
    return value as PeerDisplayMode;
  }
  return fallback;
}

function createAdapterFromPeerStore<TData>(store: PeerStore<TData>): PeerEntitiesDBAdapter {
  const mapEntityToRow = (entity: PeerEntity<TData> | undefined): PeerDialogRow | undefined => {
    if (!entity) return undefined;
    return {
      nodeId: String(entity.nodeId),
      displayMode: entity.displayMode,
      dialogPosition: entity.dialogPosition ?? undefined,
      dialogSize: entity.dialogSize ?? undefined,
      updatedAt: entity.updatedAt,
    } satisfies PeerDialogRow;
  };

  return {
    table: () => ({
      get: async (id: string) => mapEntityToRow(await store.get(id as NodeId)),
      put: async (row: PeerDialogRow) => {
        const existing = await store.get(row.nodeId as NodeId);
        const nextDisplayMode = normalizeDisplayMode(row.displayMode, existing?.displayMode);
        const baseEntity: PeerEntity<TData> =
          existing ?? ({ nodeId: row.nodeId as NodeId } as PeerEntity<TData>);
        const next: PeerEntity<TData> = {
          ...baseEntity,
          displayMode: nextDisplayMode,
          dialogPosition: row.dialogPosition ?? existing?.dialogPosition ?? null,
          dialogSize: row.dialogSize ?? existing?.dialogSize ?? null,
          updatedAt: row.updatedAt ?? existing?.updatedAt ?? Date.now(),
        };
        await store.put(next);
      },
      delete: async (id: string) => {
        await store.delete(id as NodeId);
      },
    }),
  };
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
      async getDisplayMode() {
        return null;
      },
      async setDisplayMode() {
        /* no-op */
      },
      async getPosition() {
        return null;
      },
      async setPosition() {
        /* no-op */
      },
      async getSize() {
        return null;
      },
      async setSize() {
        /* no-op */
      },
      async copyState() {
        /* no-op */
      },
    };
  }

  private createDefaultProvider(nodeType: string): PeerDialogPersistence {
    const ensureDB = async () => {
      if (this.dbCache.has(nodeType)) return this.dbCache.get(nodeType);
      if (!nodeType || typeof nodeType !== 'string') {
        this.dbCache.set(nodeType, null);
        return null;
      }

      const overrides =
        typeof globalThis !== 'undefined'
          ? (globalThis as typeof globalThis & {
              __HDB_PLUGIN_ENTITY_OVERRIDES__?: EntitiesOverrideRegistry;
            })
          : undefined;
      const overrideFactory = overrides?.__HDB_PLUGIN_ENTITY_OVERRIDES__?.[nodeType];
      if (overrideFactory) {
        const instance =
          typeof overrideFactory === 'function'
            ? await Promise.resolve(overrideFactory())
            : overrideFactory;
        if (instance) {
          this.dbCache.set(nodeType, instance);
          return instance;
        }
        this.dbCache.set(nodeType, null);
        return null;
      }

      const registry = await resolveStoreRegistry();
      const peerStore = registry?.getPeer(nodeType);
      if (peerStore) {
        const adapter = createAdapterFromPeerStore(peerStore);
        this.dbCache.set(nodeType, adapter);
        return adapter;
      }

      if (typeof console !== 'undefined') {
        console.warn('[UIPersistenceRegistry] No peer store registered for node type', nodeType);
      }
      this.dbCache.set(nodeType, null);
      return null;
    };

    const withRow = async (
      nodeId: string,
      updater: (row: PeerDialogRow) => void | Promise<void>
    ) => {
      const db = await ensureDB();
      if (!db) return;
      const tbl = db.table('peerEntities');
      const row = (await tbl.get(nodeId)) ?? { nodeId };
      await Promise.resolve(updater(row));
      row.updatedAt = Date.now();
      await tbl.put(row);
    };

    return {
      getDisplayMode: async (nodeId) => {
        const db = await ensureDB();
        if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        const raw = row?.displayMode ?? null;
        if (raw === 'normal' || raw === 'maximize' || raw === 'full-screen') {
          return raw;
        }
        if (raw === 'standard' || raw === 'maximized' || raw === 'fullscreen') {
          const migrated =
            raw === 'standard' ? 'normal' : raw === 'maximized' ? 'maximize' : 'full-screen';
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
      setDisplayMode: async (nodeId, mode) =>
        withRow(nodeId, (r) => {
          r.displayMode = mode;
        }),
      getPosition: async (nodeId) => {
        const db = await ensureDB();
        if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        return (row?.dialogPosition as PeerDialogPosition) ?? null;
      },
      setPosition: async (nodeId, pos) =>
        withRow(nodeId, (r) => {
          r.dialogPosition = pos;
        }),
      getSize: async (nodeId) => {
        const db = await ensureDB();
        if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        return (row?.dialogSize as PeerDialogSize) ?? null;
      },
      setSize: async (nodeId, size) =>
        withRow(nodeId, (r) => {
          r.dialogSize = size;
        }),
      copyState: async (fromId, toId) => {
        const db = await ensureDB();
        if (!db) return;
        const tbl = db.table('peerEntities');
        const src = await tbl.get(fromId);
        if (!src) return;
        const dst = (await tbl.get(toId)) || { nodeId: toId };
        if (src.displayMode) {
          const raw = src.displayMode;
          const normalized =
            raw === 'normal' || raw === 'maximize' || raw === 'full-screen'
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
export const getPeerDisplayMode = (nodeType: string, nodeId: string) =>
  UIPersistence.get(nodeType).getDisplayMode(nodeId);
export const setPeerDisplayMode = (nodeType: string, nodeId: string, mode: PeerDisplayMode) =>
  UIPersistence.get(nodeType).setDisplayMode(nodeId, mode);
export const getPeerDialogPosition = (nodeType: string, nodeId: string) =>
  UIPersistence.get(nodeType).getPosition(nodeId);
export const setPeerDialogPosition = (nodeType: string, nodeId: string, pos: PeerDialogPosition) =>
  UIPersistence.get(nodeType).setPosition(nodeId, pos);
export const getPeerDialogSize = (nodeType: string, nodeId: string) =>
  UIPersistence.get(nodeType).getSize(nodeId);
export const setPeerDialogSize = (nodeType: string, nodeId: string, size: PeerDialogSize) =>
  UIPersistence.get(nodeType).setSize(nodeId, size);
