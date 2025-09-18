export type PeerDisplayMode = 'standard' | 'maximized' | 'fullscreen';
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

type EntitiesDBOverride = {
  table: (name: string) => {
    get: (id: string) => Promise<any>;
    put: (row: any) => Promise<void>;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __HDB_PLUGIN_ENTITY_OVERRIDES__:
    | Record<string, EntitiesDBOverride | (() => EntitiesDBOverride | Promise<EntitiesDBOverride>)>
    | undefined;
}

class UIPersistenceRegistry {
  private providers = new Map<string, PeerDialogPersistence>();
  private dbCache = new Map<string, { table: (name: string) => { get: (id: string) => Promise<any>; put: (row: any) => Promise<void> } } | null>();

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
        __HDB_PLUGIN_ENTITY_OVERRIDES__?: Record<string, EntitiesDBOverride | (() => EntitiesDBOverride | Promise<EntitiesDBOverride>)>;
      }) : undefined;
      const overrideFactory = overrides?.__HDB_PLUGIN_ENTITY_OVERRIDES__?.[nodeType];
      if (overrideFactory) {
        const instance = typeof overrideFactory === 'function' ? await Promise.resolve(overrideFactory()) : overrideFactory;
        this.dbCache.set(nodeType, instance);
        return instance;
      }

      const className = `${nodeType.charAt(0).toUpperCase()}${nodeType.slice(1)}EntitiesDB`;
      const basePaths = [
        `@hierarchidb/${nodeType}-plugin/worker/${nodeType}EntitiesDB`,
        `@hierarchidb/${nodeType}-plugin/worker/index`,
        `@hierarchidb/${nodeType}-plugin/worker`,
        `@hierarchidb/${nodeType}-plugin/dist/worker/${nodeType}EntitiesDB`,
        `@hierarchidb/${nodeType}-plugin/dist/worker/index`,
        `@hierarchidb/${nodeType}-plugin/dist/worker`,
        `@hierarchidb/${nodeType}-plugin/src/worker/${nodeType}EntitiesDB`,
        `@hierarchidb/${nodeType}-plugin/src/worker/index`,
        `@hierarchidb/${nodeType}-plugin/src/worker`,
      ];
      const extensions = ['.js', '.mjs', '.mts', '.ts', ''];
      const candidates = Array.from(new Set(
        basePaths.flatMap((base) => extensions.map((ext) => (ext ? `${base}${ext}` : base))),
      ));

      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const mod: any = await import(/* @vite-ignore */ candidate);
          const Ctor = mod[className];
          if (!Ctor) {
            lastError = new Error(`Export ${className} missing in ${candidate}`);
            continue;
          }
          const db = new Ctor();
          await db.open?.();
          this.dbCache.set(nodeType, db);
          return db;
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

    const withRow = async (nodeId: string, updater: (row: any) => void | Promise<void>) => {
      const db = await ensureDB(); if (!db) return;
      const tbl = db.table('peerEntities');
      const row = (await tbl.get(nodeId)) || { nodeId };
      await Promise.resolve(updater(row));
      row.updatedAt = Date.now();
      await tbl.put(row);
    };

    return {
      getDisplayMode: async (nodeId) => {
        const db = await ensureDB(); if (!db) return null;
        const row = await db.table('peerEntities').get(nodeId);
        return (row?.displayMode as PeerDisplayMode) ?? null;
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
        dst.displayMode = src.displayMode ?? dst.displayMode;
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
