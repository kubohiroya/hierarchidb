/// <reference types="vite/client" />

import type { PeerStore } from '@hierarchidb/runtime-worker';
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import { SPREADSHEET_NODE_TYPE } from '../../plugin-manifest.js';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
};

export interface RegisterSpreadsheetWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(
  options: RegisterSpreadsheetWorkerStoresOptions = {}
): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }

  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    return (runtime as { storeRegistry?: StoreRegistry }).storeRegistry ?? null;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[spreadsheet-worker] failed to import runtime-worker worker module', error);
    }
    return null;
  }
}

const ensurePeerStore = (registry: StoreRegistry): void => {
  if (registry.getPeer(SPREADSHEET_NODE_TYPE)) {
    return;
  }

  registry.registerPeer(
    SPREADSHEET_NODE_TYPE,
    createNodePayloadPeerStore<SpreadsheetEntity>({
      normalize: (value) => (value ? { ...value } : undefined),
    })
  );
};

export async function registerSpreadsheetWorkerStores(
  options: RegisterSpreadsheetWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  ensurePeerStore(registry);
}

// Side-effect registration to preserve legacy behavior
registerSpreadsheetWorkerStores().catch(() => {});
