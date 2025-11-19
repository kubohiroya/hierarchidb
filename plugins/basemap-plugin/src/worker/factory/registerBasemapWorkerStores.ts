/// <reference types="vite/client" />

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

import type { TreeNode } from '@hierarchidb/common-types';
import type { PeerStore } from '@hierarchidb/runtime-worker';
import type { BasemapPeerData } from '../../common/types/BaseMapEntity.js';
import { PLUGIN_NODE_TYPE } from '../../plugin-manifest.js';
import type { BasemapEntitiesDB } from '../basemapEntitiesDB.js';
import { extractPresentationFromNodeData, normalizeBasemapPeerData } from '../utils/presentation.js';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
};

export interface RegisterBasemapWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(
  options: RegisterBasemapWorkerStoresOptions = {}
): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }

  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[basemap-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

type BasemapEntitiesDBCtor = new () => BasemapEntitiesDB;

function extractBasemapEntitiesDBCtor(mod: unknown): BasemapEntitiesDBCtor | undefined {
  const namedExport = (mod as { BasemapEntitiesDB?: unknown })?.BasemapEntitiesDB;
  if (typeof namedExport === 'function') {
    return namedExport as BasemapEntitiesDBCtor;
  }

  const defaultExport = (mod as { default?: unknown })?.default;
  if (typeof defaultExport === 'function') {
    return defaultExport as BasemapEntitiesDBCtor;
  }

  if (defaultExport && typeof defaultExport === 'object') {
    const nested = (defaultExport as { BasemapEntitiesDB?: unknown }).BasemapEntitiesDB;
    if (typeof nested === 'function') {
      return nested as BasemapEntitiesDBCtor;
    }
  }

  return undefined;
}

async function loadBasemapEntitiesDBCtor(): Promise<BasemapEntitiesDBCtor> {
  try {
    const mod = await import('@hierarchidb/basemap-plugin/worker-database');
    const ctor = extractBasemapEntitiesDBCtor(mod);

    if (ctor) {
      return ctor;
    }
    throw new TypeError('[basemap-worker] BasemapEntitiesDB export missing or invalid');
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[basemap-worker] worker-database import failed, falling back to source module', error);
    }
    const fallback = (await import('../basemapEntitiesDB.js')) as { BasemapEntitiesDB: BasemapEntitiesDBCtor };
    return fallback.BasemapEntitiesDB;
  }
}

async function ensureBasemapStores(registry: StoreRegistry): Promise<void> {
  const BasemapEntitiesDB = await loadBasemapEntitiesDBCtor();
  const db = new BasemapEntitiesDB();
  await db.open?.();

  if (!registry.getPeer(PLUGIN_NODE_TYPE)) {
    const { createBasemapPeerStoreDexie } = await import('../basemapPeerStore.dexie.js');
    registry.registerPeer(PLUGIN_NODE_TYPE, createBasemapPeerStoreDexie(db));
  }

  await ensureBasemapPeerComposer();
}

let peerComposerRegistered = false;

async function ensureBasemapPeerComposer(): Promise<void> {
  if (peerComposerRegistered) return;
  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    if (typeof runtime.registerPeerDataComposer === 'function') {
      runtime.registerPeerDataComposer(PLUGIN_NODE_TYPE, composeBasemapPeerData);
      peerComposerRegistered = true;
    }
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[basemap-worker] failed to register peer data composer', error);
    }
  }
}

const composeBasemapPeerData = (node: TreeNode): BasemapPeerData => {
  const data = normalizeBasemapPeerData({
    presentation: extractPresentationFromNodeData((node as { data?: unknown }).data),
  });
  return data;
};

export async function registerBasemapWorkerStores(
  options: RegisterBasemapWorkerStoresOptions = {}
): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureBasemapStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[basemap-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadBasemapEntitiesDbModule() {
  return import('@hierarchidb/basemap-plugin/worker-database').catch(async (error) => {
    if (import.meta.env?.DEV) {
      console.warn('[basemap-worker] worker-database module import fallback triggered', error);
    }
    return import('../basemapEntitiesDB.js');
  });
}

// Preserve legacy side-effect registration
registerBasemapWorkerStores().catch(() => {});
