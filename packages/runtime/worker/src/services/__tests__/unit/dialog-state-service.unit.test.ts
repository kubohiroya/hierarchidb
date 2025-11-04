import type { MultiStepDialogState } from '@hierarchidb/common-types';
import { toNodeId } from '@hierarchidb/common-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeerEntity, PeerStore } from '../../../entity/store.js';
import { storeRegistry } from '../../../entity/store-registry.js';
import { DialogStateService } from '../../DialogStateService.js';

class InMemoryPeerStore implements PeerStore {
  private entities = new Map<string, PeerEntity>();

  async get(nodeId: string): Promise<PeerEntity | undefined> {
    return this.entities.get(nodeId);
  }

  async put(entity: PeerEntity): Promise<void> {
    this.entities.set(entity.nodeId, entity);
  }

  async delete(nodeId: string): Promise<void> {
    this.entities.delete(nodeId);
  }
}

const TEST_NODE_TYPE = 'dialog-state-test-node';

describe('DialogStateService', () => {
  const service = new DialogStateService();

  beforeEach(() => {
    storeRegistry.registerPeer(TEST_NODE_TYPE, new InMemoryPeerStore());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists published state and retrieves it via getState', async () => {
    const snapshot: MultiStepDialogState = {
      nodeId: toNodeId('node-1'),
      activeStepIndex: 0,
      steps: [{ id: 'basic', title: 'Basic', enabled: true, completed: false, error: null }],
      canProceedNext: true,
      canGoBack: false,
      canSave: false,
      canStartBatch: false,
      validationErrors: undefined,
      updatedAt: Date.now(),
      metadata: { title: 'Create Folder', subtitle: 'Draft', committableStepIndices: [0] },
    };

    await service.publishState({
      nodeType: TEST_NODE_TYPE,
      nodeId: toNodeId('node-1'),
      state: snapshot,
    });

    const stored = await service.getState({ nodeType: TEST_NODE_TYPE, nodeId: toNodeId('node-1') });
    expect(stored).toMatchObject({ ...snapshot, updatedAt: expect.any(Number) });
  });

  it('notifies subscribers and honors unsubscribe', async () => {
    const callback = vi.fn();

    const subscriptionId = await service.subscribeState(
      { nodeType: TEST_NODE_TYPE, nodeId: toNodeId('node-2') },
      callback
    );

    expect(subscriptionId).toBeDefined();
    // Initial emit with current snapshot (none)
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(null);

    const nextState: MultiStepDialogState = {
      nodeId: toNodeId('node-2'),
      activeStepIndex: 1,
      steps: [
        { id: 'basic', title: 'Basic', enabled: true, completed: true, error: null },
        { id: 'details', title: 'Details', enabled: true, completed: false, error: null },
      ],
      canProceedNext: true,
      canGoBack: true,
      canSave: true,
      canStartBatch: false,
      validationErrors: undefined,
      updatedAt: Date.now(),
      metadata: { title: 'Create', subtitle: 'Details', committableStepIndices: [1] },
    };

    await service.publishState({
      nodeType: TEST_NODE_TYPE,
      nodeId: toNodeId('node-2'),
      state: nextState,
    });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodeId: toNodeId('node-2'),
        activeStepIndex: 1,
      })
    );

    await service.unsubscribeState(subscriptionId);

    await service.publishState({
      nodeType: TEST_NODE_TYPE,
      nodeId: toNodeId('node-2'),
      state: null,
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('warns when peer store is missing but does not throw', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      service.publishState({
        nodeType: 'unknown-node-type',
        nodeId: toNodeId('missing'),
        state: null,
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      '[DialogStateService] no peer store registered for nodeType',
      'unknown-node-type'
    );
  });
});
