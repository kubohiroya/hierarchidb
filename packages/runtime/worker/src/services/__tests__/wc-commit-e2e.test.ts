import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { CoreDB } from '../CoreDB.js';
import { CommandProcessor } from '../CommandProcessor.js';
import { WorkingCopyService } from '../WorkingCopyService.js';
import { WorkerErrorCode } from '../command-types.js';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import {
  assertCommandFailure,
  assertCommandSuccess,
  assertCommitConflict,
  assertCommitNameConflict,
  assertCommitOk,
} from '../../test-utils/assertions.js';

describe('WorkingCopy commit E2E (flags fixed ON)', () => {
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

  it('create draft and commit via CommandProcessor V2', async () => {
    // Arrange: create a draft under Resources root
    const parentId = 'r:root' as NodeId;
    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: uniqueName('Draft Folder') });
    expect(draft).toBeTruthy();

    // Act: commit the working copy
    const holder = await core.nodes.get(draft.parentId);
    const expectedNodeId = holder?.holderTargetId;
    
    const res = await wc.commitWorkingCopy(draft.id);
    assertCommitOk(res, 'commitWorkingCopy');

    // Assert: committed node exists under canonical node id
    if (!expectedNodeId) throw new Error('Expected holderTargetId to be set');
    const committed = await core.nodes.get(expectedNodeId);
    expect(committed).toBeTruthy();
    expect(res.node?.id).toBe(expectedNodeId);
    expect(res.node?.name).toBe(committed?.name);
    // Parent should not be a workingCopy holder after commit
    if (!committed) throw new Error('Committed node not found');
    const parent = await core.nodes.get(committed.parentId);
    expect(parent?.nodeType).not.toBe('workingCopy');
  });

  it('returns canonical nodeId when committing a draft working copy', async () => {
    const parentId = 'r:root' as NodeId;
    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: uniqueName('Draft Canonical') });
    const holder = await core.nodes.get(draft.parentId);
    expect(holder).toBeTruthy();
    const expectedNodeId = holder?.holderTargetId;
    expect(typeof expectedNodeId).toBe('string');

    if (!expectedNodeId) throw new Error('Expected holder target to be defined');

    const env = cp.createEnvelope('commitWorkingCopy', { workingCopyId: draft.id, onNameConflict: 'auto-rename' });
    const result = await cp.processCommand(env);
    assertCommandSuccess(result, 'commitWorkingCopy');
    expect(result.status).toBe('ok');
    expect(result.nodeId).toBe(expectedNodeId);

    const committed = await core.nodes.get(expectedNodeId);
    expect(committed).toBeTruthy();
  });

  it('auto-rename draft commit returns updated node payload', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Auto Rename');

    const first = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const firstHolder = await core.nodes.get(first.parentId);
    const firstExpected = firstHolder?.holderTargetId;
    expect(typeof firstExpected).toBe('string');
    if (!firstExpected) throw new Error('Expected holder target for first commit');
    const firstRes = await wc.commitWorkingCopy(first.id);
    assertCommitOk(firstRes, 'first commit');

    const committedFirst = await core.nodes.get(firstExpected);
    expect(committedFirst?.name).toBe(baseName);

    const second = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const secondHolder = await core.nodes.get(second.parentId);
    const secondExpected = secondHolder?.holderTargetId;
    expect(typeof secondExpected).toBe('string');

    if (!secondExpected) throw new Error('Expected holder target for second commit');
    const res = await wc.commitWorkingCopy(second.id);
    assertCommitOk(res, 'second commit');
    expect(res.node).toBeTruthy();
    expect(res.node?.id).toBe(secondExpected);
    expect(res.node?.name).not.toBe(baseName);

    const stored = await core.nodes.get(secondExpected);
    expect(stored?.name).toBe(res.node?.name);
  });

  it('surfaces NAME_CONFLICT when policy is error', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Conflict Draft');

    const first = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const firstHolder = await core.nodes.get(first.parentId);
    if (!firstHolder?.holderTargetId) throw new Error('Expected holder target for first commit');
    const firstResult = await wc.commitWorkingCopy(first.id, { onNameConflict: 'auto-rename' });
    expect(firstResult.status).toBe('ok');

    const second = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const conflict = await wc.commitWorkingCopy(second.id, { onNameConflict: 'error' });
    assertCommitNameConflict(conflict, 'name conflict policy error');
    expect(conflict.suggestedName).toMatch(new RegExp(`^${baseName}`));

    const workingCopyStillExists = await core.nodes.get(second.id);
    expect(workingCopyStillExists).toBeTruthy();
  });

  it('returns COMMIT_CONFLICT when canonical node version advances', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('Conflict Edit');

    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const holder = await core.nodes.get(draft.parentId);
    if (!holder?.holderTargetId) throw new Error('Expected holder target for draft commit');
    const canonicalId = holder.holderTargetId as NodeId;
    await wc.commitWorkingCopy(draft.id);

    const editWc = await wc.createWorkingCopyFromNode(canonicalId);
    const canonicalNode = await core.nodes.get(canonicalId);
    if (!canonicalNode) throw new Error('Canonical node not found');
    await core.updateNode({ id: canonicalId, version: (canonicalNode.version ?? 1) + 1 });

    const conflict = await wc.commitWorkingCopy(editWc.id as NodeId, { onNameConflict: 'auto-rename' });
    assertCommitConflict(conflict, 'worker commit conflict');
    expect(conflict.originalVersion).toBeGreaterThan(conflict.wcVersion ?? 0);
  });

  it('CommandProcessor exposes conflict metadata in CommandResult', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = uniqueName('CP Conflict');

    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const holder = await core.nodes.get(draft.parentId);
    if (!holder?.holderTargetId) throw new Error('Expected holder target');
    await wc.commitWorkingCopy(draft.id);

    const second = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });

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

    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const holder = await core.nodes.get(draft.parentId);
    if (!holder?.holderTargetId) throw new Error('Expected holder target');
    const canonicalId = holder.holderTargetId as NodeId;
    await wc.commitWorkingCopy(draft.id);

    const editWc = await wc.createWorkingCopyFromNode(canonicalId);
    const canonicalNode = await core.nodes.get(canonicalId);
    if (!canonicalNode) throw new Error('Canonical node not found');
    await core.updateNode({ id: canonicalId, version: (canonicalNode.version ?? 1) + 1 });

    const envelope = cp.createEnvelope('commitWorkingCopy', {
      workingCopyId: editWc.id,
      onNameConflict: 'auto-rename',
    });
    const result = await cp.processCommand(envelope);
    assertCommandFailure(result, 'cp COMMIT_CONFLICT');
    expect(result.code).toBe(WorkerErrorCode.COMMIT_CONFLICT);
    expect(result.status).toBe('COMMIT_CONFLICT');
    expect(result.originalVersion).toBeGreaterThan(result.wcVersion ?? 0);
  });
});
