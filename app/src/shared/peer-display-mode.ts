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

// Strongly-typed helpers (nodeType is a union of supported kinds)
export async function getPeerDisplayMode<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
): Promise<PeerDisplayMode | null> {
  if (nodeType === 'project' || nodeType === 'linker') return null;
  switch (nodeType) {
    case 'folder': {
      const M = '@hierarchidb' + '/folder-plugin/src/worker/folderEntitiesDB';
      const { FolderEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (FolderEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.displayMode as PeerDisplayMode) ?? null;
    }
    case 'route': {
      const M = '@hierarchidb' + '/route-plugin/src/worker/routeEntitiesDB';
      const { RouteEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (RouteEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.displayMode as PeerDisplayMode) ?? null;
    }
    case 'resolver': {
      const M = '@hierarchidb' + '/resolver-plugin/src/worker/resolverEntitiesDB';
      const { ResolverEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (ResolverEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.displayMode as PeerDisplayMode) ?? null;
    }
    case 'project': {
      // Back-compat: map legacy 'project' to linker's peer DB
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.displayMode as PeerDisplayMode) ?? null;
    }
    case 'linker': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.displayMode as PeerDisplayMode) ?? null;
    }
    default:
      return null;
  }
}

export async function setPeerDisplayMode<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
  mode: PeerDisplayMode,
): Promise<void> {
  if (nodeType === 'project' || nodeType === 'linker') return;
  switch (nodeType) {
    case 'folder': {
      const M = '@hierarchidb' + '/folder-plugin/src/worker/folderEntitiesDB';
      const { FolderEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (FolderEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.displayMode = mode; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'route': {
      const M = '@hierarchidb' + '/route-plugin/src/worker/routeEntitiesDB';
      const { RouteEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (RouteEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.displayMode = mode; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'resolver': {
      const M = '@hierarchidb' + '/resolver-plugin/src/worker/resolverEntitiesDB';
      const { ResolverEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (ResolverEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.displayMode = mode; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'project': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.displayMode = mode; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'linker': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.displayMode = mode; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    default:
      return;
  }
}

// Position persistence
export async function getPeerDialogPosition<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
): Promise<PeerDialogPosition | null> {
  if (nodeType === 'project' || nodeType === 'linker') return null;
  switch (nodeType) {
    case 'folder': {
      const M = '@hierarchidb' + '/folder-plugin/src/worker/folderEntitiesDB';
      const { FolderEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (FolderEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogPosition as PeerDialogPosition) ?? null;
    }
    case 'route': {
      const M = '@hierarchidb' + '/route-plugin/src/worker/routeEntitiesDB';
      const { RouteEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (RouteEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogPosition as PeerDialogPosition) ?? null;
    }
    case 'resolver': {
      const M = '@hierarchidb' + '/resolver-plugin/src/worker/resolverEntitiesDB';
      const { ResolverEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (ResolverEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogPosition as PeerDialogPosition) ?? null;
    }
    case 'linker': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogPosition as PeerDialogPosition) ?? null;
    }
    default:
      return null;
  }
}

export async function setPeerDialogPosition<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
  pos: PeerDialogPosition,
): Promise<void> {
  if (nodeType === 'project' || nodeType === 'linker') return;
  switch (nodeType) {
    case 'folder': {
      const M = '@hierarchidb' + '/folder-plugin/src/worker/folderEntitiesDB';
      const { FolderEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (FolderEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogPosition = pos; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'route': {
      const M = '@hierarchidb' + '/route-plugin/src/worker/routeEntitiesDB';
      const { RouteEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (RouteEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogPosition = pos; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'resolver': {
      const M = '@hierarchidb' + '/resolver-plugin/src/worker/resolverEntitiesDB';
      const { ResolverEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (ResolverEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogPosition = pos; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'project': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogPosition = pos; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'linker': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogPosition = pos; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    default:
      return;
  }
}

// Size persistence
export async function getPeerDialogSize<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
): Promise<PeerDialogSize | null> {
  if (nodeType === 'project' || nodeType === 'linker') return null;
  switch (nodeType) {
    case 'folder': {
      const M = '@hierarchidb' + '/folder-plugin/src/worker/folderEntitiesDB';
      const { FolderEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (FolderEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogSize as PeerDialogSize) ?? null;
    }
    case 'route': {
      const M = '@hierarchidb' + '/route-plugin/src/worker/routeEntitiesDB';
      const { RouteEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (RouteEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogSize as PeerDialogSize) ?? null;
    }
    case 'resolver': {
      const M = '@hierarchidb' + '/resolver-plugin/src/worker/resolverEntitiesDB';
      const { ResolverEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (ResolverEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogSize as PeerDialogSize) ?? null;
    }
    case 'project': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogSize as PeerDialogSize) ?? null;
    }
    case 'linker': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row = await db.table('peerEntities').get(nodeId as any) as any;
      return (row?.dialogSize as PeerDialogSize) ?? null;
    }
    default:
      return null;
  }
}

export async function setPeerDialogSize<T extends PeerDisplayNodeType>(
  nodeType: T,
  nodeId: string,
  size: PeerDialogSize,
): Promise<void> {
  if (nodeType === 'project' || nodeType === 'linker') return;
  switch (nodeType) {
    case 'folder': {
      const M = '@hierarchidb' + '/folder-plugin/src/worker/folderEntitiesDB';
      const { FolderEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (FolderEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogSize = size; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'route': {
      const M = '@hierarchidb' + '/route-plugin/src/worker/routeEntitiesDB';
      const { RouteEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (RouteEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogSize = size; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'resolver': {
      const M = '@hierarchidb' + '/resolver-plugin/src/worker/resolverEntitiesDB';
      const { ResolverEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (ResolverEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogSize = size; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'project': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogSize = size; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    case 'linker': {
      const M = '@hierarchidb' + '/linker-plugin/src/worker/linkerEntitiesDB';
      const { LinkerEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (LinkerEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.dialogSize = size; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    default:
      return;
  }
}
