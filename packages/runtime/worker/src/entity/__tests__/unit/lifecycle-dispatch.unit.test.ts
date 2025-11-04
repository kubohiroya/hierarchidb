import type {
  CommitWorkingCopyPayload,
  DuplicateNodesPayload,
  ImportNodesPayload,
  NodeId,
  PasteNodesPayload,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import type { CommandEnvelope } from '../../../services/command-types.js';
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
      payload: { workingCopyId, expectedUpdatedAt: Date.now() as Timestamp },
      issuedAt: Date.now() as Timestamp,
    };
  }

  function makeDuplicateEnvelope(): CommandEnvelope<'duplicateNodes', DuplicateNodesPayload> {
    return {
      commandId: 'cmd-dup',
      groupId: 'grp',
      kind: 'duplicateNodes',
      payload: { nodeIds: ['a' as NodeId], toParentId: 'p' as NodeId },
      issuedAt: Date.now() as Timestamp,
    };
  }

  function makePasteEnvelope(): CommandEnvelope<'pasteNodes', PasteNodesPayload> {
    const nodes = {} as Record<NodeId, TreeNode>;
    return {
      commandId: 'cmd-paste',
      groupId: 'grp',
      kind: 'pasteNodes',
      payload: {
        nodes,
        nodeIds: [],
        toParentId: 'p' as NodeId,
      },
      issuedAt: Date.now() as Timestamp,
    };
  }

  function makeImportEnvelope(): CommandEnvelope<'importNodes', ImportNodesPayload> {
    const nodes = {} as Record<NodeId, TreeNode>;
    return {
      commandId: 'cmd-import',
      groupId: 'grp',
      kind: 'importNodes',
      payload: {
        nodes,
        nodeIds: [],
        toParentId: 'p' as NodeId,
      },
      issuedAt: Date.now() as Timestamp,
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
