import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';

describe('EntityLifecycleManager integration (base skeleton)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('notifies lifecycle on commitWorkingCopy when flag ON', async () => {
    const core: any = {
      getNode: vi.fn(async (_id: NodeId) => undefined),
      updateNode: vi.fn(),
      createNode: vi.fn(),
    };
    const { EntityLifecycleManager } = await import('~/entity/EntityLifecycleManager');
    const spy = vi.spyOn(EntityLifecycleManager, 'getSingleton');
    const mock = {
      handleCommand: vi.fn(async () => {
      }),
    } as any;
    spy.mockReturnValue(mock);

    const { CommandProcessor } = await import('~/services/CommandProcessor');
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('commitWorkingCopy', { workingCopyId: 'wc1' as NodeId } as any);
    const r = await cp.processCommand(env as any);
    expect(r.success).toBeDefined();
    expect(mock.handleCommand).toHaveBeenCalledTimes(1);
  });
});
