/// <reference types="vite/client" />

import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import type { PeerStore } from '@hierarchidb/runtime-worker';
import type { StylerPeerData } from '../../common/types/stylerTypes.js';

const normalizeStylerPeerData = (data?: StylerPeerData | null): StylerPeerData => ({
  schemaVersion: 1,
  lastAppliedConfig: data?.lastAppliedConfig,
  metadata: data?.metadata ?? {},
});

type StoreRegistry = {
  getPeer(nodeType: string): PeerStore | undefined;
  registerPeer(nodeType: string, store: PeerStore): void;
};

export interface RegisterStylerWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(
  options: RegisterStylerWorkerStoresOptions = {}
): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[styler-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

async function ensureStylerStores(registry: StoreRegistry): Promise<void> {
  if (!registry.getPeer('styler')) {
    registry.registerPeer(
      'styler',
      createNodePayloadPeerStore({
        normalize: (data) => normalizeStylerPeerData(data ?? undefined),
      })
    );
  }
}

export async function registerStylerWorkerStores(
  options: RegisterStylerWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureStylerStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[styler-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadStylerEntitiesDbModule() {
  return undefined;
}

registerStylerWorkerStores().catch(() => {});
