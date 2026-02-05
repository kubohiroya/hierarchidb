import type { NodeId, Timestamp } from '@hierarchidb/core-types'; //A
import type { TreeChangeEvent } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import type { CoreDB } from '../../../services/CoreDB.js';

describe('EntityLifecycleManager integration (base skeleton)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('notifies lifecycle on commitDraft when flag ON', async () => {
    const core: Pick<CoreDB, 'getNode' | 'updateNode' | 'createNode'> & { changeSubject: Subject<TreeChangeEvent> } = {
      getNode: vi.fn(async () => undefined),
      updateNode: vi.fn(async () => undefined),
      createNode: vi.fn(async () => undefined),
      changeSubject: new Subject<TreeChangeEvent>(),
    };
    const { EntityLifecycleManager } = await import('../../EntityLifecycleManager.js');
    type LifecycleInstance = ReturnType<typeof EntityLifecycleManager.getSingleton>;
    const lifecycleMock = {
      handleCommand: vi.fn(async () => undefined),
    } satisfies Pick<LifecycleInstance, 'handleCommand'>;
    const getSingletonSpy = vi
      .spyOn(EntityLifecycleManager, 'getSingleton')
      .mockReturnValue(lifecycleMock as unknown as LifecycleInstance);

    const { commandRegistry } = await import('../../../services/command/registry.js');
    commandRegistry.register('commitDraft', {
      execute: async ({ nextSeq }) => ({ success: true, seq: nextSeq() }),
    });

    const { CommandProcessor } = await import('../../../services/CommandProcessor.js');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const wcId = 'wc1' as NodeId;
    const envelope = cp.createEnvelope('commitDraft', {
      draftId: wcId,
      expectedUpdatedAt: Date.now() as Timestamp,
    });
    const result = await cp.processCommand(envelope);

    expect(result.success).toBe(true);
    expect(lifecycleMock.handleCommand).toHaveBeenCalledTimes(1);

    getSingletonSpy.mockRestore();
  });
});
