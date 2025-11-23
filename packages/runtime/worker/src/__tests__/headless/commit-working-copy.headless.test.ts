import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { makeNode, makeDraftNode } from '../../test-utils/node-helpers.js';
import { CommandProcessor } from '../../services/CommandProcessor.js';
import { CoreDB } from '../../services/CoreDB.js';
import { WorkerErrorCode } from '../../services/command-types.js';
import { WorkingCopyService } from '../../services/WorkingCopyService.js';
import {
  assertCommandFailure,
  assertCommandSuccess,
  assertCommitConflict,
  assertCommitNameConflict,
  assertCommitOk,
} from '../../test-utils/assertions.js';

describe('WorkingCopy commit E2E (holder-less)', () => {
  let core: CoreDB;
  let cp: CommandProcessor;
  let wc: WorkingCopyService;

  beforeEach(async () => {
    core = await CoreDB.getSingleton('e2e-db');
    cp = new CommandProcessor(core);
    wc = new WorkingCopyService(core, undefined, cp);
  });

  function uniqueName(base: string): string {
    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }

  it('creates and fetches a draft working copy by id', async () => {
    const parentId = 'r:root' as NodeId;
    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, {
      metadata: { name: uniqueName('Draft Lookup') },
    } as Partial<TreeNode>);

    const byId = await wc.getWorkingCopy(draft.id as NodeId);
    expect(byId?.id).toBe(draft.id);
    expect(byId?.draftData).toBeTruthy();
    expect(byId?.data).toBeNull();
  });

  it('commits a new draft and clears draftData', async () => {
    const parentId = 'r:root' as NodeId;
    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, {
      metadata: { name: uniqueName('Draft Folder') },
    } as Partial<TreeNode>);

    const res = await wc.commitWorkingCopy(draft.id);
    assertCommitOk(res, 'commitWorkingCopy');
    const committed = await core.nodes.get(res.nodeId);
    expect(committed?.draftData).toBeNull();
    expect(committed?.data).toBeTruthy();
    expect(committed?.version).toBe((draft.version ?? 1) + 1);
  });

  it('assigns depth relative to the parent when committing nested drafts', async () => {
    const rootId = 'r:root' as NodeId;
    const level1Draft = await wc.createDraftWorkingCopy('folder' as NodeType, rootId, {
      metadata: { name: uniqueName('Depth L1') },
    } as Partial<TreeNode>);
    const level1Result = await wc.commitWorkingCopy(level1Draft.id, {
      onNameConflict: 'auto-rename',
    });
    assertCommitOk(level1Result, 'level1 commit');

    const level1Node = await core.nodes.get(level1Result.nodeId as NodeId);
    expect(level1Node?.depth).toBe(1);

    const level2Draft = await wc.createDraftWorkingCopy('folder' as NodeType, level1Result.nodeId, {
      metadata: { name: uniqueName('Depth L2') },
    } as Partial<TreeNode>);
    const level2Result = await wc.commitWorkingCopy(level2Draft.id, {
      onNameConflict: 'auto-rename',
    });
    assertCommitOk(level2Result, 'level2 commit');

    const level2Node = await core.nodes.get(level2Result.nodeId as NodeId);
    expect(level2Node?.depth).toBe((level1Node?.depth ?? 0) + 1);

    const reloadedParent = await core.nodes.get(level1Result.nodeId as NodeId);
    expect(reloadedParent?.depth).toBe(level1Node?.depth);
  });

  it('returns NAME_CONFLICT when policy is error', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Conflict Draft');

    const first = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, {
      metadata: { name: baseName },
    } as Partial<TreeNode>);
    const firstResult = await wc.commitWorkingCopy(first.id, { onNameConflict: 'auto-rename' });
    expect(firstResult.status).toBe('ok');

    const second = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, {
      metadata: { name: baseName },
    } as Partial<TreeNode>);
    const conflict = await wc.commitWorkingCopy(second.id, { onNameConflict: 'error' });
    assertCommitNameConflict(conflict, 'name conflict policy error');
    expect(conflict.suggestedName).toMatch(new RegExp(`^${baseName}`));

    const workingCopyStillExists = await core.nodes.get(second.id);
    expect(workingCopyStillExists).toBeTruthy();
  });

  it('auto-rename draft commit returns updated node payload', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Auto Rename');

    const first = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, {
      metadata: { name: baseName },
    } as Partial<TreeNode>);
    const firstRes = await wc.commitWorkingCopy(first.id);
    assertCommitOk(firstRes, 'first commit');

    const committedFirst = await core.nodes.get(firstRes.nodeId);
    expect(committedFirst?.metadata.name).toBe(baseName);

    const second = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, {
      metadata: { name: baseName },
    } as Partial<TreeNode>);

    const res = await wc.commitWorkingCopy(second.id, { onNameConflict: 'auto-rename' });
    assertCommitOk(res, 'second commit');
    expect(res.autoRenameTo).toBeTruthy();

    const stored = await core.nodes.get(res.nodeId);
    expect(stored?.metadata.name).toBe(res.autoRenameTo);
  });

  it('returns COMMIT_CONFLICT when canonical node version advances', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Conflict Edit');

    const draft = await wc.createDraftWorkingCopy(
      'folder' as NodeType,
      parentId,
      makeDraftNode({ name: baseName })
    );
    const commitResult = await wc.commitWorkingCopy(draft.id);
    assertCommitOk(commitResult, 'initial commit');
    const canonicalId = commitResult.nodeId as NodeId;

    const editWc = await wc.createWorkingCopyFromNode(canonicalId);
    const canonicalNode = await core.nodes.get(canonicalId);
    if (!canonicalNode) throw new Error('Canonical node not found');
    await core.updateNode({ id: canonicalId, version: (canonicalNode.version ?? 1) + 1 });

    const conflict = await wc.commitWorkingCopy(editWc.id as NodeId, {
      onNameConflict: 'auto-rename',
    });
    assertCommitConflict(conflict, 'worker commit conflict');
    expect(conflict.originalVersion).toBeGreaterThan(conflict.wcVersion ?? 0);
  });

  it('CommandProcessor surfaces NAME_CONFLICT metadata', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('CP Conflict');

    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, {
      metadata: { name: baseName },
    } as Partial<TreeNode>);
    await wc.commitWorkingCopy(draft.id);

    const second = await wc.createDraftWorkingCopy(
      'folder' as NodeType,
      parentId,
      makeDraftNode({ name: baseName })
    );

    const envelope = cp.createEnvelope('commitWorkingCopy', {
      workingCopyId: second.id,
      onNameConflict: 'error',
    });
    const result = await cp.processCommand(envelope);
    assertCommandFailure(result, 'cp NAME_CONFLICT');
    expect(result.code).toBe(WorkerErrorCode.VALIDATION_ERROR);
    expect(result.status).toBe('NAME_CONFLICT');
    expect(result.suggestedName).toBeTruthy();
  });

  it('CommandProcessor emits COMMIT_CONFLICT details', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('CP Commit Conflict');

    const draft = await wc.createDraftWorkingCopy(
      'folder' as NodeType,
      parentId,
      makeDraftNode({ name: baseName })
    );
    const commitResult = await wc.commitWorkingCopy(draft.id);
    assertCommitOk(commitResult, 'initial commit');
    const canonicalId = commitResult.nodeId as NodeId;

    const editWc = await wc.createWorkingCopyFromNode(canonicalId);
    const canonicalNode = await core.nodes.get(canonicalId);
    if (!canonicalNode) throw new Error('Canonical node not found');
    await core.updateNode({ id: canonicalId, version: (canonicalNode.version ?? 1) + 1 });

    const envelope = cp.createEnvelope('commitWorkingCopy', {
      workingCopyId: editWc.id as NodeId,
      onNameConflict: 'auto-rename',
    });
    const result = await cp.processCommand(envelope);
    expect(result.status).toBe('COMMIT_CONFLICT');
    if (result.status !== 'COMMIT_CONFLICT') {
      throw new Error('Expected commit conflict');
    }
    expect(result.originalVersion).toBeGreaterThan(result.wcVersion ?? 0);
  });
});
