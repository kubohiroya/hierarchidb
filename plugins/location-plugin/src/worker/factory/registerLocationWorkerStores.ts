/// <reference types="vite/client" />


import type { GroupItemBase, GroupStore, PeerStore, RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import { normalizePeerData } from '../normalizers.js';
import { isDevEnvironment } from '../../common/utils/env.js';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
  getGroup<T extends GroupItemBase<any> = GroupItemBase<any>>(nodeType: string): GroupStore<T> | undefined;
  registerGroup<T extends GroupItemBase<any>>(nodeType: string, store: GroupStore<T>): void;
  getRelations<T extends RelationBase<any> = RelationBase<any>>(nodeType: string): RelationStore<T> | undefined;
  registerRelations<T extends RelationBase<any>>(nodeType: string, store: RelationStore<T>): void;
};

export interface RegisterLocationWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterLocationWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  return null;
}

async function ensureLocationStores(registry: StoreRegistry): Promise<void> {
  const { LocationEntitiesDB } = await import('../locationEntitiesDB.js');
  const db = new LocationEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('location')) {
    registry.registerPeer(
      'location',
      createNodePayloadPeerStore({
        normalize: (data) => normalizePeerData(data ?? undefined),
      })
    );
  }
  if (!registry.getGroup('location')) {
    const { createLocationGroupStoreDexie } = await import('../locationGroupStore.dexie.js');
    registry.registerGroup('location', createLocationGroupStoreDexie(db));
  }
  if (!registry.getRelations('location')) {
    const { createLocationRelationStoreDexie } = await import('../locationRelationStore.dexie.js');
    registry.registerRelations('location', createLocationRelationStoreDexie(db));
  }
}

export async function registerLocationWorkerStores(options: RegisterLocationWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) return;
  const registry = await resolveStoreRegistry(options);
  if (!registry) return;
  try {
    await ensureLocationStores(registry);
  } catch (error) {
    if (isDevEnvironment) console.warn('[location-worker] store registration failed', error);
  }
}

type LocationEntitiesDbModule = typeof import('../locationEntitiesDB.js');

export async function loadLocationEntitiesDbModule(): Promise<LocationEntitiesDbModule | null> {
  try {
    return await import('../locationEntitiesDB.js');
  } catch {
    return null;
  }
}

// Side-effect for legacy consumers
registerLocationWorkerStores().catch(() => {});
