export type PeerDisplayMode = 'standard' | 'maximized' | 'fullscreen';
export type PeerDisplayNodeType =
  | 'folder'
  | 'route'
  | 'resolver'
  | 'project'
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
      const M = '@hierarchidb' + '/project-plugin/src/worker/projectEntitiesDB';
      const { ProjectEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (ProjectEntitiesDB as any)();
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
      const M = '@hierarchidb' + '/project-plugin/src/worker/projectEntitiesDB';
      const { ProjectEntitiesDB } = (await import(/* @vite-ignore */ (M as string))) as any;
      const db = new (ProjectEntitiesDB as any)();
      const row: any = (await db.table('peerEntities').get(nodeId as any)) || { nodeId };
      row.displayMode = mode; row.updatedAt = Date.now();
      await db.table('peerEntities').put(row);
      return;
    }
    default:
      return;
  }
}
