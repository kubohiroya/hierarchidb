import type { Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-type';

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

type DexieInstance = import('dexie').Dexie;
interface PeerEntityRecord {
  nodeId: NodeId;
  updatedAt?: number;
  displayMode?: string;
  dialogPosition?: PeerDialogPosition;
  dialogSize?: PeerDialogSize;
  data?: unknown;
}

type PeerEntitiesDB = DexieInstance & { peerEntities: Table<PeerEntityRecord, NodeId> };
type PeerDbLoader = () => Promise<PeerEntitiesDB>;

const createLoader = (specifier: string, exportName: string): PeerDbLoader =>
  async () => {
    const mod = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
    const Constructor = mod[exportName] as new () => PeerEntitiesDB;
    return new Constructor();
  };

const peerDbLoaders: Partial<Record<PeerDisplayNodeType, PeerDbLoader>> = {
  folder: createLoader('@hierarchidb/plugins-folder-plugin/worker', 'FolderEntitiesDB'),
  route: createLoader('@hierarchidb/plugins-route-plugin/worker', 'RouteEntitiesDB'),
  resolver: createLoader('@hierarchidb/plugins-resolver-plugin/worker', 'ResolverEntitiesDB'),
  basemap: createLoader('@hierarchidb/plugins-basemap-plugin/worker', 'BasemapEntitiesDB'),
  location: createLoader('@hierarchidb/plugins-location-plugin/worker', 'LocationEntitiesDB'),
  shape: createLoader('@hierarchidb/plugins-shape-plugin/worker', 'ShapeEntitiesDB'),
  spreadsheet: createLoader('@hierarchidb/plugins-spreadsheet-plugin/worker', 'SpreadsheetEntitiesDB'),
  styler: createLoader('@hierarchidb/plugins-styler-plugin/worker', 'StylerEntitiesDB'),
};

const toNodeId = (value: string): NodeId => value as NodeId;

async function withPeerDb<T>(
  nodeType: PeerDisplayNodeType,
  fallback: T,
  fn: (db: PeerEntitiesDB) => Promise<T>,
): Promise<T> {
  const loader = peerDbLoaders[nodeType];
  if (!loader) return fallback;
  const db = await loader();
  try {
    return await fn(db);
  } finally {
    db.close();
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
