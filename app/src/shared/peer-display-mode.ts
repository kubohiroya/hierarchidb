import type { NodeId } from '../generated/loader.js';

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

interface PeerEntityRecord {
  nodeId: NodeId;
  updatedAt?: number;
  displayMode?: string;
  dialogPosition?: PeerDialogPosition;
  dialogSize?: PeerDialogSize;
  data?: unknown;
}

// Generated static plugin loader (prebuild)
import { peerDbLoaders as generatedPeerDbLoaders, PeerDbLoader, registerUIPersistenceOverrides, type PeerEntitiesDB } from '../generated/loader.js';

// Initialize UI persistence overrides at module load
try { registerUIPersistenceOverrides(); } catch { /* ignore */ }

// Narrowed view for this module; generated loaders return instances compatible with PeerEntitiesDB
const peerDbLoaders: Partial<Record<PeerDisplayNodeType, PeerDbLoader>> = generatedPeerDbLoaders as any;

const toNodeId = (value: string): NodeId => value as NodeId;

async function withPeerDb<T>(
  nodeType: PeerDisplayNodeType,
  fallback: T,
  fn: (db: PeerEntitiesDB) => Promise<T>,
): Promise<T> {
  const loader = peerDbLoaders[nodeType];
  if (!loader) return fallback;
  const db = await loader();
  if(!db) throw new Error("cannot load db.");
  try {
    return await fn(db);
  } finally {
    // Close if the DB provides a close() method (optional in generated type)
    (db as any).close?.();
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
    const globalAny = globalThis as any;
    const overrides = (globalAny.__HDB_PLUGIN_ENTITY_OVERRIDES__ ??= {});

    const toAdapterFactory = (loader: PeerDbLoader) => async () => {
      const db = await loader();
      if (!db) {
        return { table: () => ({ get: async () => undefined, put: async () => {} }) };
      }
      if (typeof (db as any).open === 'function') {
        try { await (db as any).open(); } catch { /* ignore */ }
      }
      return {
        table: (_name: string) => ({
          get: (id: string) => (db as any).peerEntities.get(toNodeId(id)),
          put: (row: any) => (db as any).peerEntities.put(row),
        }),
      };
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
