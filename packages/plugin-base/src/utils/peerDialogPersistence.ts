import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';

export type PeerDisplayMode = 'normal' | 'maximize' | 'full-screen';
export type PeerDialogPosition = { x: number; y: number };
export type PeerDialogSize = { width: number; height: number };

type PeerDialogWindowState = {
  mode?: PeerDisplayMode;
  position?: PeerDialogPosition | null;
  size?: PeerDialogSize | null;
};

type PeerDialogProgressState = {
  activeStepIndex: number;
};

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

type LegacyDialogRow = {
  nodeId: string;
  displayMode?: PeerDisplayMode | LegacyDisplayMode;
  dialogPosition?: PeerDialogPosition | null;
  dialogSize?: PeerDialogSize | null;
};

type PeerDialogRow = LegacyDialogRow & {
  dialogWindow?: PeerDialogWindowState | null;
  dialogProgress?: PeerDialogProgressState | null;
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
          console.debug('[UIPersistenceRegistry] runtime-worker-worker storeRegistry unavailable', error);
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

function cloneDialogWindow(state?: PeerDialogWindowState | null): PeerDialogWindowState | undefined {
  if (!state) return undefined;
  return {
    mode: state.mode,
    position: state.position ? { ...state.position } : state.position ?? null,
    size: state.size ? { ...state.size } : state.size ?? null,
  };
}

function normalizeDialogWindow(
  next: PeerDialogWindowState | null | undefined,
  existing?: PeerDialogWindowState | null
): PeerDialogWindowState | undefined {
  const source = next ?? undefined;
  const fallback = existing ?? undefined;
  const mode = normalizeDisplayMode(source?.mode, fallback?.mode);
  const position = source?.position ?? fallback?.position ?? null;
  const size = source?.size ?? fallback?.size ?? null;
  if (!mode && !position && !size) {
    return undefined;
  }
  return { mode, position, size };
}

function extractDialogWindow(row: PeerDialogRow): PeerDialogWindowState | undefined {
  if (row.dialogWindow) {
    return normalizeDialogWindow(row.dialogWindow);
  }
  const mode = normalizeDisplayMode(row.displayMode, undefined);
  if (!mode && !row.dialogPosition && !row.dialogSize) {
    return undefined;
  }
  return {
    mode,
    position: row.dialogPosition ?? null,
    size: row.dialogSize ?? null,
  };
}

function clearLegacyDialogFields(row: PeerDialogRow): void {
  delete row.displayMode;
  delete row.dialogPosition;
  delete row.dialogSize;
}

function createAdapterFromPeerStore(store: PeerStore<unknown>): PeerEntitiesDBAdapter {
  const mapEntityToRow = (entity: PeerEntity | undefined): PeerDialogRow | undefined => {
    if (!entity) return undefined;
    return {
      nodeId: String(entity.nodeId),
      dialogWindow: cloneDialogWindow(entity.dialogWindow),
      dialogProgress: entity.dialogProgress ? { ...entity.dialogProgress } : undefined,
      updatedAt: entity.updatedAt,
    } satisfies PeerDialogRow;
  };

  return {
    table: () => ({
      get: async (id: string) => mapEntityToRow(await store.get(id as NodeId)),
      put: async (row: PeerDialogRow) => {
        const existing = await store.get(row.nodeId as NodeId);
        const nextDialogWindow = normalizeDialogWindow(row.dialogWindow, existing?.dialogWindow);
        const baseEntity: PeerEntity = existing ?? ({ nodeId: row.nodeId as NodeId } as PeerEntity);
        const next: PeerEntity = {
          ...baseEntity,
          dialogWindow: nextDialogWindow,
          dialogProgress: row.dialogProgress ?? existing?.dialogProgress ?? null,
          updatedAt: row.updatedAt ?? existing?.updatedAt ?? Date.now(),
        };
        clearLegacyDialogFields(row);
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
  private warningExclusions = new Set<string>(['folder']);

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

      if (typeof console !== 'undefined' && this.shouldWarn(nodeType)) {
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
      clearLegacyDialogFields(row);
      await tbl.put(row);
    };

    return {
      getDisplayMode: async (nodeId) => {
        const db = await ensureDB();
        if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        const state = row ? extractDialogWindow(row) : undefined;
        return state?.mode ?? null;
      },
      setDisplayMode: async (nodeId, mode) =>
        withRow(nodeId, (r) => {
          const normalized = normalizeDialogWindow(
            { ...(r.dialogWindow ?? extractDialogWindow(r) ?? {}), mode },
            r.dialogWindow ?? extractDialogWindow(r)
          );
          r.dialogWindow = normalized;
        }),
      getPosition: async (nodeId) => {
        const db = await ensureDB();
        if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        const state = row ? extractDialogWindow(row) : undefined;
        const pos = state?.position ?? null;
        return pos ? { ...pos } : pos;
      },
      setPosition: async (nodeId, pos) =>
        withRow(nodeId, (r) => {
          const normalized = normalizeDialogWindow(
            { ...(r.dialogWindow ?? extractDialogWindow(r) ?? {}), position: pos },
            r.dialogWindow ?? extractDialogWindow(r)
          );
          r.dialogWindow = normalized;
        }),
      getSize: async (nodeId) => {
        const db = await ensureDB();
        if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        const state = row ? extractDialogWindow(row) : undefined;
        const size = state?.size ?? null;
        return size ? { ...size } : size;
      },
      setSize: async (nodeId, size) =>
        withRow(nodeId, (r) => {
          const normalized = normalizeDialogWindow(
            { ...(r.dialogWindow ?? extractDialogWindow(r) ?? {}), size },
            r.dialogWindow ?? extractDialogWindow(r)
          );
          r.dialogWindow = normalized;
        }),
      copyState: async (fromId, toId) => {
        const db = await ensureDB();
        if (!db) return;
        const tbl = db.table('peerEntities');
        const src = await tbl.get(fromId);
        if (!src) return;
        await withRow(toId, (dst) => {
          const sourceWindow = extractDialogWindow(src);
          if (sourceWindow) {
            dst.dialogWindow = {
              ...(dst.dialogWindow ?? extractDialogWindow(dst) ?? {}),
              ...sourceWindow,
            };
          }
          if (src.dialogProgress) {
            dst.dialogProgress = { ...src.dialogProgress };
          }
        });
      },
    };
  }

  private shouldWarn(nodeType: string): boolean {
    if (!nodeType) return false;
    return !this.isWarningSuppressed(nodeType);
  }

  private normalizeNodeType(nodeType: string | undefined): string | null {
    if (!nodeType) return null;
    const normalized = nodeType.trim();
    return normalized ? normalized : null;
  }

  suppressWarningFor(nodeType: string): void {
    this.addWarningExclusion(nodeType);
  }

  addWarningExclusion(nodeType: string | undefined): void {
    const normalized = this.normalizeNodeType(nodeType);
    if (normalized) {
      this.warningExclusions.add(normalized);
    }
  }

  removeWarningExclusion(nodeType: string | undefined): void {
    const normalized = this.normalizeNodeType(nodeType);
    if (normalized) {
      this.warningExclusions.delete(normalized);
    }
  }

  setWarningExclusions(nodeTypes: Iterable<string>): void {
    this.warningExclusions.clear();
    for (const nodeType of nodeTypes) {
      this.addWarningExclusion(nodeType);
    }
  }

  isWarningSuppressed(nodeType: string | undefined): boolean {
    const normalized = this.normalizeNodeType(nodeType);
    if (!normalized) return false;
    return this.warningExclusions.has(normalized);
  }

  getWarningExclusions(): string[] {
    return Array.from(this.warningExclusions);
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
