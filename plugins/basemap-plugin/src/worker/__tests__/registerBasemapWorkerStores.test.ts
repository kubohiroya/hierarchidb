import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { PeerStore } from '@hierarchidb/runtime-worker';
import type { BasemapPeerData } from '../../common/types/BaseMapEntity.js';
import { PLUGIN_NODE_TYPE } from '../../plugin-manifest.js';
import { registerBasemapWorkerStores } from '../factory/registerBasemapWorkerStores.js';

const peerStoreStub: PeerStore<BasemapPeerData> = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  bulkUpsert: vi.fn(),
};

vi.mock('@hierarchidb/runtime-worker-worker', () => ({
  createNodePayloadPeerStore: () => peerStoreStub,
}));

type FakeRegistry = {
  getPeer: ReturnType<typeof vi.fn>;
  registerPeer: ReturnType<typeof vi.fn>;
};

const createFakeRegistry = (hasExistingStore = false): FakeRegistry => ({
  getPeer: vi.fn().mockReturnValue(hasExistingStore ? peerStoreStub : undefined),
  registerPeer: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerBasemapWorkerStores', () => {
  it('registers peer store when none exists', async () => {
    const registry = createFakeRegistry(false);

    await registerBasemapWorkerStores({ storeRegistry: registry });

    expect(registry.registerPeer).toHaveBeenCalledTimes(1);
    expect(registry.registerPeer).toHaveBeenCalledWith(PLUGIN_NODE_TYPE, peerStoreStub);
  });

  it('is idempotent when peer store already exists', async () => {
    const registry = createFakeRegistry(true);

    await registerBasemapWorkerStores({ storeRegistry: registry });

    expect(registry.registerPeer).not.toHaveBeenCalled();
  });

  it('respects an aborted signal', async () => {
    const registry = createFakeRegistry(false);
    const controller = new AbortController();
    controller.abort();

    await registerBasemapWorkerStores({ storeRegistry: registry, signal: controller.signal });

    expect(registry.registerPeer).not.toHaveBeenCalled();
  });
});
