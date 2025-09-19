import type { Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-type';

export type PeerDisplayMode = 'standard' | 'maximized' | 'fullscreen';
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
  displayMode?: PeerDisplayMode;
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
  folder: createLoader('@hierarchidb/folder-plugin/src/worker/folderEntitiesDB', 'FolderEntitiesDB'),
  route: createLoader('@hierarchidb/route-plugin/src/worker/routeEntitiesDB', 'RouteEntitiesDB'),
  resolver: createLoader('@hierarchidb/resolver-plugin/src/worker/resolverEntitiesDB', 'ResolverEntitiesDB'),
  basemap: createLoader('@hierarchidb/basemap-plugin/src/worker/basemapEntitiesDB', 'BasemapEntitiesDB'),
  location: createLoader('@hierarchidb/location-plugin/src/worker/locationEntitiesDB', 'LocationEntitiesDB'),
  shape: createLoader('@hierarchidb/shape-plugin/src/worker/shapeEntitiesDB', 'ShapeEntitiesDB'),
  spreadsheet: createLoader('@hierarchidb/spreadsheet-plugin/src/worker/spreadsheetEntitiesDB', 'SpreadsheetEntitiesDB'),
  styler: createLoader('@hierarchidb/styler-plugin/src/worker/stylerEntitiesDB', 'StylerEntitiesDB'),
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
    return row?.displayMode ?? null;
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
