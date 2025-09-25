import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CommandEnvelope,
  CommitWorkingCopyPayload,
  DuplicateNodesPayload,
  ImportNodesPayload,
  PasteNodesPayload,
} from '../../services/command-types.js';
import type { NodeId, Timestamp } from '@hierarchidb/common-type';
import type { CoreDB } from '../../services/CoreDB.js';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';

describe('EntityLifecycleManager dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.set(EntityLifecycleManager, 'instance', undefined);
  });

  function makeCommitEnvelope(): CommandEnvelope<'commitWorkingCopy', CommitWorkingCopyPayload> {
    const workingCopyId = 'wc-1' as NodeId;
    return {
      commandId: 'cmd-commit',
      groupId: 'grp',
      kind: 'commitWorkingCopy',
      payload: { workingCopyId },
      issuedAt: Date.now() as Timestamp,
      type: 'commitWorkingCopy',
    };
  }

  function makeDuplicateEnvelope(): CommandEnvelope<'duplicateNodes', DuplicateNodesPayload> {
    return {
      commandId: 'cmd-dup',
      groupId: 'grp',
      kind: 'duplicateNodes',
      payload: { nodeIds: ['a' as NodeId], toParentId: 'p' as NodeId },
      issuedAt: Date.now() as Timestamp,
      type: 'duplicateNodes',
    };
  }

  function makePasteEnvelope(): CommandEnvelope<'pasteNodes', PasteNodesPayload> {
    return {
      commandId: 'cmd-paste',
      groupId: 'grp',
      kind: 'pasteNodes',
      payload: {
        nodes: {},
        nodeIds: [],
        toParentId: 'p' as NodeId,
      },
      issuedAt: Date.now() as Timestamp,
      type: 'pasteNodes',
    };
  }

  function makeImportEnvelope(): CommandEnvelope<'importNodes', ImportNodesPayload> {
    return {
      commandId: 'cmd-import',
      groupId: 'grp',
      kind: 'importNodes',
      payload: {
        nodes: {},
        nodeIds: [],
        toParentId: 'p' as NodeId,
      },
      issuedAt: Date.now() as Timestamp,
      type: 'importNodes',
    };
  }

  it('routes commitWorkingCopy to onCommitWorkingCopy', async () => {
    const mgr = EntityLifecycleManager.getSingleton({} as unknown as CoreDB);
    const spy = vi.spyOn(mgr, 'onCommitWorkingCopy').mockResolvedValue();
    await mgr.handleCommand(makeCommitEnvelope());
    expect(spy).toHaveBeenCalledOnce();
  });

  it('routes duplicateNodes to onDuplicateNodes', async () => {
    const mgr = EntityLifecycleManager.getSingleton({} as unknown as CoreDB);
    const spy = vi.spyOn(mgr, 'onDuplicateNodes').mockResolvedValue();
    await mgr.handleCommand(makeDuplicateEnvelope());
    expect(spy).toHaveBeenCalledOnce();
  });

  it('routes pasteNodes to onPasteNodes', async () => {
    const mgr = EntityLifecycleManager.getSingleton({} as unknown as CoreDB);
    const spy = vi.spyOn(mgr, 'onPasteNodes').mockResolvedValue();
    await mgr.handleCommand(makePasteEnvelope());
    expect(spy).toHaveBeenCalledOnce();
  });

  it('routes importNodes to onImportNodes', async () => {
    const mgr = EntityLifecycleManager.getSingleton({} as unknown as CoreDB);
    const spy = vi.spyOn(mgr, 'onImportNodes').mockResolvedValue();
    await mgr.handleCommand(makeImportEnvelope());
    expect(spy).toHaveBeenCalledOnce();
  });
});
