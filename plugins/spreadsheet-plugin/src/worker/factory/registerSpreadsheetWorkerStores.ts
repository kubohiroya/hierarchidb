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

export interface RegisterSpreadsheetWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterSpreadsheetWorkerStoresOptions = {}): Promise<StoreRegistry | undefined> {
  return options.storeRegistry;

  /*
  try {
    const { importRuntimeWorker } = await import('@hierarchidb/runtime-worker');
    const runtime = await importRuntimeWorker();
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[spreadsheet-worker] failed to import runtime worker module', error);
    }
    return null;

  }
  */
}


async function ensureSpreadsheetStores(registry: StoreRegistry): Promise<void> {
  const { SpreadsheetEntitiesDB } = await import('..//spreadsheetEntitiesDB.js');
  const db = new SpreadsheetEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('spreadsheet')) {
    const { createSpreadsheetPeerStoreDexie } = await import('../spreadsheetPeerStore.dexie.js');
    registry.registerPeer('spreadsheet', createSpreadsheetPeerStoreDexie(db));
  }

  if (!registry.getGroup('spreadsheet')) {
    const { createSpreadsheetGroupStoreDexie } = await import('../spreadsheetGroupStore.dexie.js');
    registry.registerGroup('spreadsheet', createSpreadsheetGroupStoreDexie(db));
  }

  if (!registry.getRelations('spreadsheet')) {
    const { createSpreadsheetRelationStoreDexie } = await import('../spreadsheetRelationStore.dexie.js');
    registry.registerRelations('spreadsheet', createSpreadsheetRelationStoreDexie(db));
  }
}

export async function registerSpreadsheetWorkerStores(options: RegisterSpreadsheetWorkerStoresOptions = {}): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureSpreadsheetStores(registry);
  } catch (error) {
    console.warn('[spreadsheet-worker] failed to register Dexie stores', error);
  }
}

export async function loadSpreadsheetEntitiesDbModule() {
  return import(/* @vite-ignore */ '../spreadsheetEntitiesDB.js');
}

registerSpreadsheetWorkerStores().catch(() => {});
