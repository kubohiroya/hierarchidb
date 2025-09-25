import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { CoreDB } from '../CoreDB.js';
import { CommandProcessor } from '../CommandProcessor.js';
import { WorkingCopyService } from '../WorkingCopyService.js';
import type { NodeId, NodeType } from '@hierarchidb/common-type';

describe('WorkingCopy commit E2E (flags fixed ON)', () => {
  let core: CoreDB;
  let cp: CommandProcessor;
  let wc: WorkingCopyService;

  beforeEach(async () => {
    core = await CoreDB.getSingleton('e2e-db');
    cp = new CommandProcessor(core);
    wc = new WorkingCopyService(core, undefined, cp);
  });

  it('create draft and commit via CommandProcessor V2', async () => {
    // Arrange: create a draft under Resources root
    const parentId = 'r:root' as NodeId;
    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: 'Draft Folder' });
    expect(draft).toBeTruthy();

    // Act: commit the working copy
    const holder = await core.nodes.get(draft.parentId);
    const expectedNodeId = holder?.holderTargetId;
    
    const res = await wc.commitWorkingCopy(draft.id);
    expect(res.success).toBe(true);

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
    const draft = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: 'Draft Canonical' });
    const holder = await core.nodes.get(draft.parentId);
    expect(holder).toBeTruthy();
    const expectedNodeId = holder?.holderTargetId;
    expect(typeof expectedNodeId).toBe('string');

    if (!expectedNodeId) throw new Error('Expected holder target to be defined');

    const env = cp.createEnvelope('commitWorkingCopy', { workingCopyId: draft.id, onNameConflict: 'auto-rename' });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(true);
    expect(result.nodeId).toBe(expectedNodeId);

    const committed = await core.nodes.get(expectedNodeId);
    expect(committed).toBeTruthy();
  });

  it('auto-rename draft commit returns updated node payload', async () => {
    const parentId = 'r:root' as NodeId;
    const baseName = 'Auto Rename';

    const first = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const firstHolder = await core.nodes.get(first.parentId);
    const firstExpected = firstHolder?.holderTargetId;
    expect(typeof firstExpected).toBe('string');
    if (!firstExpected) throw new Error('Expected holder target for first commit');
    const firstRes = await wc.commitWorkingCopy(first.id);
    expect(firstRes.success).toBe(true);

    const committedFirst = await core.nodes.get(firstExpected);
    expect(committedFirst?.name).toBe(baseName);

    const second = await wc.createDraftWorkingCopy('folder' as NodeType, parentId, { name: baseName });
    const secondHolder = await core.nodes.get(second.parentId);
    const secondExpected = secondHolder?.holderTargetId;
    expect(typeof secondExpected).toBe('string');

    if (!secondExpected) throw new Error('Expected holder target for second commit');
    const res = await wc.commitWorkingCopy(second.id);
    expect(res.success).toBe(true);
    expect(res.node).toBeTruthy();
    expect(res.node?.id).toBe(secondExpected);
    expect(res.node?.name).not.toBe(baseName);

    const stored = await core.nodes.get(secondExpected);
    expect(stored?.name).toBe(res.node?.name);
  });
});
