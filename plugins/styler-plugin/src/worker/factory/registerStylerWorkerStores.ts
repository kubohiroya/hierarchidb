import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import type { PeerStore } from '@hierarchidb/runtime-worker';
import type { StylerEntity } from '../../common/types/StylerEntity.js';
import { StylerConfigDefault } from '../../common/types/stylerTypes.js';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
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
  return null;
}

const normalizeStylerEntity = (data?: StylerEntity): StylerEntity | undefined => {
  if (!data) return undefined;
  return {
    ...data,
    stylerConfig: data.stylerConfig ?? StylerConfigDefault,
    selectedKeyColumn: data.selectedKeyColumn ?? data.stylerConfig?.keyColumn ?? '',
    selectedValueColumn: data.selectedValueColumn ?? data.stylerConfig?.valueColumn ?? '',
  };
};

async function ensureStylerStores(registry: StoreRegistry): Promise<void> {
  if (!registry.getPeer('styler')) {
    registry.registerPeer(
      'styler',
      createNodePayloadPeerStore<StylerEntity>({
        normalize: normalizeStylerEntity,
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
    const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
    if (isDev) {
      console.warn('[styler-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadStylerEntitiesDbModule() {
  return undefined;
}

registerStylerWorkerStores().catch(() => {});
