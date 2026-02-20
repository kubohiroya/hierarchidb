import type { NodeId, Timestamp } from '@hierarchidb/core-types';
import type {
  CommitDraftPayload,
  DuplicateNodesPayload,
  ImportNodesPayload,
  PasteNodesPayload,
  TreeNode,
} from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB';
import type { CommandEnvelope } from '../../../services/command-types';
import { EntityLifecycleManager } from '../../EntityLifecycleManager';

describe('EntityLifecycleManager dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.set(EntityLifecycleManager, 'instance', undefined);
  });

  function makeCommitEnvelope(): CommandEnvelope<'commitDraft', CommitDraftPayload> {
    const draftId = 'wc-1' as NodeId;
    return {
      commandId: 'cmd-commit',
      groupId: 'grp',
      kind: 'commitDraft',
      payload: { draftId, expectedUpdatedAt: Date.now() as Timestamp },
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

  it('routes commitDraft to onCommitDraft', async () => {
    const mgr = EntityLifecycleManager.getSingleton({} as unknown as CoreDB);
    const spy = vi.spyOn(mgr, 'onCommitDraft').mockResolvedValue();
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
