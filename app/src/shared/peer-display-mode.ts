export type PeerDisplayMode = 'normal' | 'maximize' | 'full-screen';
export type PeerDialogPosition = { x: number; y: number };
export type PeerDialogSize = { width: number; height: number };
export type PeerDisplayNodeType =
  | 'folder'
  | 'route'
  | 'resolver'
  | 'project'
  | 'linker'
  | 'shape'
  | 'location'
  | 'spreadsheet'
  | 'styler'
  | 'basemap';

// Generated static plugin loader (prebuild)
import {
  peerDbLoaders as generatedPeerDbLoaders,
  type PeerDbLoader,
  registerUIPersistenceOverrides,
  type PeerEntitiesDB,
  type PeerEntityRecord,
  type NodeId,
} from '../generated/loader.js';

// Initialize UI persistence overrides at module load
try { registerUIPersistenceOverrides(); } catch { /* ignore */ }

// Narrowed view for this module; generated loaders return instances compatible with PeerEntitiesDB
const KNOWN_NODE_TYPES: ReadonlyArray<PeerDisplayNodeType> = [
  'folder',
  'route',
  'resolver',
  'project',
  'linker',
  'shape',
  'location',
  'spreadsheet',
  'styler',
  'basemap',
];

const peerDbLoaders: Partial<Record<PeerDisplayNodeType, PeerDbLoader>> = {};
for (const nodeType of KNOWN_NODE_TYPES) {
  const loader = generatedPeerDbLoaders[nodeType];
  if (loader) {
    peerDbLoaders[nodeType] = loader;
  }
}

const toNodeId = (value: string): NodeId => value as NodeId;

async function withPeerDb<T>(
  nodeType: PeerDisplayNodeType,
  fallback: T,
  fn: (db: PeerEntitiesDB) => Promise<T>,
): Promise<T> {
  const loader = peerDbLoaders[nodeType];
  if (!loader) return fallback;
  const db = await loader();
  if (!db) throw new Error('cannot load db.');
  try {
    return await fn(db);
  } finally {
    // Close if the DB provides a close() method (optional in generated type)
    const close = db.close;
    if (typeof close === 'function') {
      try {
        await close.call(db);
      } catch {
        // ignore close errors to avoid masking the primary result
      }
    }
  }
}

export async function getPeerDisplayMode<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
): Promise<PeerDisplayMode | null> {
  return withPeerDb(nodeType, null, async (db) => {
    const row = await db.peerEntities.get(toNodeId(nodeId));
    const raw = row?.displayMode ?? null;
    if (raw === 'normal' || raw === 'maximize' || raw === 'full-screen') {
      return raw;
    }
    if (raw === 'standard' || raw === 'maximized' || raw === 'fullscreen') {
      const migrated =
        raw === 'standard' ? 'normal' : raw === 'maximized' ? 'maximize' : 'full-screen';
      if (row) {
        await db.peerEntities.put({ ...row, displayMode: migrated, updatedAt: Date.now() });
      }
      return migrated;
    }
    return null;
  });
}

export async function setPeerDisplayMode<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
  mode: PeerDisplayMode,
): Promise<void> {
  await withPeerDb(nodeType, undefined, async (db) => {
    const key = toNodeId(nodeId);
    const existing = await db.peerEntities.get(key);
    const next: PeerEntityRecord = {
      nodeId: key,
      ...existing,
      displayMode: mode,
      updatedAt: Date.now(),
    };
    await db.peerEntities.put(next);
    return undefined;
  });
}

export async function getPeerDialogPosition<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
): Promise<PeerDialogPosition | null> {
  return withPeerDb(nodeType, null, async (db) => {
    const row = await db.peerEntities.get(toNodeId(nodeId));
    return row?.dialogPosition ?? null;
  });
}

export async function setPeerDialogPosition<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
  pos: PeerDialogPosition,
): Promise<void> {
  await withPeerDb(nodeType, undefined, async (db) => {
    const key = toNodeId(nodeId);
    const existing = await db.peerEntities.get(key);
    const next: PeerEntityRecord = {
      nodeId: key,
      ...existing,
      dialogPosition: pos,
      updatedAt: Date.now(),
    };
    await db.peerEntities.put(next);
    return undefined;
  });
}

export async function getPeerDialogSize<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
): Promise<PeerDialogSize | null> {
  return withPeerDb(nodeType, null, async (db) => {
    const row = await db.peerEntities.get(toNodeId(nodeId));
    return row?.dialogSize ?? null;
  });
}

export async function setPeerDialogSize<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
  size: PeerDialogSize,
): Promise<void> {
  await withPeerDb(nodeType, undefined, async (db) => {
    const key = toNodeId(nodeId);
    const existing = await db.peerEntities.get(key);
    const next: PeerEntityRecord = {
      nodeId: key,
      ...existing,
      dialogSize: size,
      updatedAt: Date.now(),
    };
    await db.peerEntities.put(next);
    return undefined;
  });
}

// Expose EntitiesDB adapter overrides for the UI persistence registry used by runtime-ui/plugin-dialog
(() => {
  try {
    interface UiPersistenceTableAdapter {
      get: (id: string) => Promise<PeerEntityRecord | undefined>;
      put: (row: PeerEntityRecord) => Promise<NodeId | void>;
    }

    interface UiPersistenceAdapter {
      table: (_name: string) => UiPersistenceTableAdapter;
    }

    type UiPersistenceAdapterFactory = () => Promise<UiPersistenceAdapter>;

    const globalObject = globalThis as { __HDB_PLUGIN_ENTITY_OVERRIDES__?: Record<string, UiPersistenceAdapterFactory> };
    const overrides = (globalObject.__HDB_PLUGIN_ENTITY_OVERRIDES__ ??= {});

    const toAdapterFactory = (loader: PeerDbLoader): UiPersistenceAdapterFactory => async () => {
      const db = await loader();
      if (!db) {
        return {
          table: () => ({
            get: async () => undefined,
            put: async () => {},
          }),
        } satisfies UiPersistenceAdapter;
      }

      try {
        await db.open?.();
      } catch {
        // ignore and continue with the adapter; consumer may retry later
      }

      return {
        table: () => ({
          get: async (id: string) => db.peerEntities.get(toNodeId(id)),
          put: async (row: PeerEntityRecord) => db.peerEntities.put(row),
        }),
      } satisfies UiPersistenceAdapter;
    };

    (Object.keys(peerDbLoaders) as PeerDisplayNodeType[]).forEach((nodeType) => {
      const loader = peerDbLoaders[nodeType];
      if (!loader) return;
      overrides[nodeType] = toAdapterFactory(loader);
    });
  } catch {
    // non-fatal; UI will fall back to internal dynamic import logic
  }
})();
