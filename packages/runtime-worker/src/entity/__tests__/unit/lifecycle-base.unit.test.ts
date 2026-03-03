import { NodeId, Timestamp } from '@hierarchidb/core-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreDB } from '../../../services/CoreDB';

const createCoreStub = () => {
  const core = CoreDB.createForTest('runtime-worker-lifecycle-base');
  core.getNode = vi.fn(async () => undefined) as CoreDB['getNode'];
  core.updateNode = vi.fn(async () => undefined) as CoreDB['updateNode'];
  core.createNode = vi.fn(async () => undefined) as CoreDB['createNode'];
  return core;
};

describe('EntityLifecycleManager integration (base skeleton)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('notifies lifecycle on commitDraft when flag ON', async () => {
    const core = createCoreStub();

    const { EntityLifecycleManager } = await import('../../EntityLifecycleManager');
    Reflect.set(EntityLifecycleManager, 'instance', undefined);
    const lifecycleManager = EntityLifecycleManager.getSingleton(core);
    const handleCommandSpy = vi
      .spyOn(lifecycleManager, 'handleCommand')
      .mockResolvedValue(undefined);

    const { commandRegistry } = await import('../../../services/command/commandRegistry');
    commandRegistry.register('commitDraft', {
      execute: async ({ nextSeq }) => ({ success: true, seq: nextSeq() }),
    });

    const { CommandProcessor } = await import('../../../services/CommandProcessor');
    const cp = new CommandProcessor(core);
    const wcId = 'wc1' as NodeId;
    const envelope = cp.createEnvelope('commitDraft', {
      draftId: wcId,
      expectedUpdatedAt: Date.now() as Timestamp,
    });
    const result = await cp.processCommand(envelope);

    expect(result.success).toBe(true);
    expect(handleCommandSpy).toHaveBeenCalledTimes(1);

    handleCommandSpy.mockRestore();
  });
});
