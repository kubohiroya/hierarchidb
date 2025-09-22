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
};

type EntitiesDBAdapter = {
  table: (name: string) => PeerEntitiesTable;
};

declare global {
  var __HDB_PLUGIN_ENTITY_OVERRIDES__:
    | Record<string, EntitiesDBAdapter | (() => EntitiesDBAdapter | Promise<EntitiesDBAdapter>)>
    | undefined;
}

class UIPersistenceRegistry {
  private providers = new Map<string, PeerDialogPersistence>();
  private dbCache = new Map<string, EntitiesDBAdapter | null>();

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
        __HDB_PLUGIN_ENTITY_OVERRIDES__?: Record<string, EntitiesDBAdapter | (() => EntitiesDBAdapter | Promise<EntitiesDBAdapter>)>;
      }) : undefined;
      const overrideFactory = overrides?.__HDB_PLUGIN_ENTITY_OVERRIDES__?.[nodeType];
      if (overrideFactory) {
        const instance = typeof overrideFactory === 'function'
          ? await Promise.resolve(overrideFactory())
          : overrideFactory;
        this.dbCache.set(nodeType, instance);
        return instance;
      }

      const className = `${nodeType.charAt(0).toUpperCase()}${nodeType.slice(1)}EntitiesDB`;
      const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };
      const isDev = Boolean(meta.env?.DEV);
      const packageBases = [
        `@hierarchidb/plugins-${nodeType}-plugin`,
      ];
      const basePaths = packageBases.flatMap((pkg) => [
        `${pkg}/worker/${nodeType}EntitiesDB`,
        `${pkg}/worker/index`,
        `${pkg}/worker`,
      ]);
      if (isDev) {
        packageBases.forEach((pkg) => {
          basePaths.push(
            `${pkg}/src/worker/${nodeType}EntitiesDB`,
            `${pkg}/src/worker/index`,
            `${pkg}/src/worker`,
          );
        });
      }
      const extensions = ['.js', '.mjs', '.mts', '.ts', ''];
      const candidates = Array.from(new Set(
        basePaths.flatMap((base) => extensions.map((ext) => (ext ? `${base}${ext}` : base))),
      ));

      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const mod = await import(/* @vite-ignore */ candidate);
          const Ctor = mod[className];
          if (!Ctor) {
            lastError = new Error(`Export ${className} missing in ${candidate}`);
            continue;
          }
          const db = new Ctor();
          await db.open?.();
          const adapter: EntitiesDBAdapter = {
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
        } catch (err) {
          lastError = err;
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
