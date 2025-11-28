/// <reference types="vite/client" />
import type { PeerStore } from '@hierarchidb/runtime-worker';
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';

type TimelinePeerData = {
  schemaVersion: 1;
  flamePerSecond: number;
  restartIntervalInMsec: number;
};

const normalizeTimelinePeerData = (data?: TimelinePeerData | null): TimelinePeerData => ({
  schemaVersion: 1,
  flamePerSecond: typeof data?.flamePerSecond === 'number' ? data.flamePerSecond : 0,
  restartIntervalInMsec:
    typeof data?.restartIntervalInMsec === 'number' ? data.restartIntervalInMsec : 0,
});

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
};

export interface RegisterTimelineWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterTimelineWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }

  try {
    const runtimeModule = await import('@hierarchidb/runtime-worker');
    return (runtimeModule as unknown as { storeRegistry?: StoreRegistry }).storeRegistry ?? null;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[timeline-worker] failed to resolve runtime-worker worker module', error);
    }
    return null;
  }
}

async function ensureTimelineStores(registry: StoreRegistry): Promise<void> {
  if (!registry.getPeer('timeline')) {
    registry.registerPeer(
      'timeline',
      createNodePayloadPeerStore<TimelinePeerData>({
        normalize: (data) => normalizeTimelinePeerData(data ?? undefined),
      })
    );
  }
}

export async function registerTimelineWorkerStores(options: RegisterTimelineWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureTimelineStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[timeline-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadTimelineEntitiesDbModule() {
  return undefined;
}

// Maintain legacy side-effect registration for existing consumers
registerTimelineWorkerStores().catch(() => {});
