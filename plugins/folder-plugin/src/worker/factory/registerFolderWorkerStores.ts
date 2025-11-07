/// <reference types="vite/client" />

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

import type { GroupItemBase, GroupStore, PeerStore, RelationBase, RelationStore } from '@hierarchidb/runtime-worker';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
  getGroup<T extends GroupItemBase<any> = GroupItemBase<any>>(nodeType: string): GroupStore<T> | undefined;
  registerGroup<T extends GroupItemBase<any>>(nodeType: string, store: GroupStore<T>): void;
  getRelations<T extends RelationBase<any> = RelationBase<any>>(nodeType: string): RelationStore<T> | undefined;
  registerRelations<T extends RelationBase<any>>(nodeType: string, store: RelationStore<T>): void;
};

export interface RegisterFolderWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterFolderWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    type RuntimeWorkerModule = typeof import('@hierarchidb/runtime-worker') & {
      storeRegistry?: StoreRegistry;
    };
    const runtime = (await import('@hierarchidb/runtime-worker')) as RuntimeWorkerModule;
    return runtime.storeRegistry ?? null;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[folder-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

async function ensureFolderStores(registry: StoreRegistry): Promise<void> {
  const { FolderEntitiesDB } = await import('../folderEntitiesDB.js');
  const db = new FolderEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('folder')) {
    const { createFolderPeerStoreDexie } = await import('../folderPeerStore.dexie.ts');
    registry.registerPeer('folder', createFolderPeerStoreDexie(db));
  }

  if (!registry.getGroup('folder')) {
    const { createFolderGroupStoreDexie } = await import('../folderGroupStore.dexie.ts');
    registry.registerGroup('folder', createFolderGroupStoreDexie(db));
  }

  if (!registry.getRelations('folder')) {
    const { createFolderRelationStoreDexie } = await import('../folderRelationStore.dexie.ts');
    registry.registerRelations('folder', createFolderRelationStoreDexie(db));
  }
}

export async function registerFolderWorkerStores(options: RegisterFolderWorkerStoresOptions = {}): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureFolderStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[folder-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadFolderEntitiesDbModule() {
  return import('../folderEntitiesDB.js');
}

// Maintain legacy side-effect registration for existing consumers
registerFolderWorkerStores().catch(() => {});
