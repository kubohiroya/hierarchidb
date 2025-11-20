import type { PeerStore, GroupStore, RelationStore, GroupItemBase, RelationBase } from '@hierarchidb/runtime-worker';
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import type { SpreadsheetPeerData } from '../../common/types/SpreadsheetEntity.js';
import { SPREADSHEET_NODE_TYPE } from '../../common/constants.js';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
  getGroup<T extends GroupItemBase<any>>(nodeType: string): GroupStore<T> | undefined;
  getRelations<T extends RelationBase<any>>(nodeType: string): RelationStore<T> | undefined;
};

export interface RegisterSpreadsheetWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

const normalizeSpreadsheetPeerData = (data?: SpreadsheetPeerData | null): SpreadsheetPeerData => ({
  schemaVersion: 1,
  metadataId: data?.metadataId,
  lastReferencedAt: data?.lastReferencedAt,
});

async function resolveStoreRegistry(options: RegisterSpreadsheetWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    console.warn('[spreadsheet-worker] failed to resolve runtime worker store registry', error);
    return null;
  }
}

async function ensurePeerStore(registry: StoreRegistry): Promise<void> {
  if (!registry.getPeer(SPREADSHEET_NODE_TYPE)) {
    registry.registerPeer(
      SPREADSHEET_NODE_TYPE,
      createNodePayloadPeerStore({
        normalize: (value: SpreadsheetPeerData | null | undefined) => normalizeSpreadsheetPeerData(value ?? undefined),
      })
    );
  }
}

export async function registerSpreadsheetWorkerStores(options: RegisterSpreadsheetWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) return;
  const registry = await resolveStoreRegistry(options);
  if (!registry) return;
  await ensurePeerStore(registry);
}

export async function loadSpreadsheetEntitiesDbModule(): Promise<null> {
  return null;
}

registerSpreadsheetWorkerStores().catch(() => {});
