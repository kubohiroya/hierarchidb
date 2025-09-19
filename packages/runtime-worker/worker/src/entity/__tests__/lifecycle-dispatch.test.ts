import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandEnvelope } from '../../services/command-types.js';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';

describe('EntityLifecycleManager dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function make(envKind: string): CommandEnvelope<any, any> {
    return {
      commandId: 'c1',
      groupId: 'g1',
      kind: envKind as any,
      payload: {},
      issuedAt: Date.now(),
      type: envKind as any,
    } as any;
  }

  it('routes commitWorkingCopy to onCommitWorkingCopy', async () => {
    const mgr = (EntityLifecycleManager as any).getSingleton({} as any) as EntityLifecycleManager;
    const spy = vi.spyOn(mgr, 'onCommitWorkingCopy').mockResolvedValue();
    await mgr.handleCommand(make('commitWorkingCopy'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('routes duplicateNodes to onDuplicateNodes', async () => {
    const mgr = (EntityLifecycleManager as any).getSingleton({} as any) as EntityLifecycleManager;
    const spy = vi.spyOn(mgr, 'onDuplicateNodes').mockResolvedValue();
    await mgr.handleCommand(make('duplicateNodes'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('routes pasteNodes to onPasteNodes', async () => {
    const mgr = (EntityLifecycleManager as any).getSingleton({} as any) as EntityLifecycleManager;
    const spy = vi.spyOn(mgr, 'onPasteNodes').mockResolvedValue();
    await mgr.handleCommand(make('pasteNodes'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('routes importNodes to onImportNodes', async () => {
    const mgr = (EntityLifecycleManager as any).getSingleton({} as any) as EntityLifecycleManager;
    const spy = vi.spyOn(mgr, 'onImportNodes').mockResolvedValue();
    await mgr.handleCommand(make('importNodes'));
    expect(spy).toHaveBeenCalledOnce();
  });
});
