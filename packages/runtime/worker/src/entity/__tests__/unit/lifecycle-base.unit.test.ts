import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';

describe('EntityLifecycleManager integration (base skeleton)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('notifies lifecycle on commitWorkingCopy when flag ON', async () => {
    const core: Pick<CoreDB, 'getNode' | 'updateNode' | 'createNode'> = {
      getNode: vi.fn(async () => undefined),
      updateNode: vi.fn(async () => undefined),
      createNode: vi.fn(async () => undefined),
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
    commandRegistry.register('commitWorkingCopy', {
      execute: async ({ nextSeq }) => ({ success: true, seq: nextSeq() }),
    });

    const { CommandProcessor } = await import('../../../services/CommandProcessor.js');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const wcId = 'wc1' as NodeId;
    const envelope = cp.createEnvelope('commitWorkingCopy', {
      workingCopyId: wcId,
      expectedUpdatedAt: Date.now() as Timestamp,
    });
    const result = await cp.processCommand(envelope);

    expect(result.success).toBe(true);
    expect(lifecycleMock.handleCommand).toHaveBeenCalledTimes(1);

    getSingletonSpy.mockRestore();
  });
});
