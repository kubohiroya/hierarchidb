import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { CoreDB } from '../CoreDB.js';
import { CommandProcessor } from '../CommandProcessor.js';
import { WorkingCopyService } from '../WorkingCopyService.js';

describe('WorkingCopy commit E2E (flags fixed ON)', () => {
  let core: CoreDB;
  let cp: CommandProcessor;
  let wc: WorkingCopyService;

  beforeEach(async () => {
    core = await CoreDB.getSingleton('e2e-db');
    cp = new CommandProcessor(core as any);
    wc = new WorkingCopyService(core as any, {} as any, cp);
  });

  it('create draft and commit via CommandProcessor V2', async () => {
    // Arrange: create a draft under Resources root
    const parentId = 'r:root' as any;
    const draft = await wc.createDraftWorkingCopy('folder' as any, parentId, { name: 'Draft Folder' } as any);
    expect(draft).toBeTruthy();

    // Act: commit the working copy
    const holder = await core.nodes.get(draft.parentId as any);
    const expectedNodeId = (holder as any)?.holderTargetId;

    const res = await wc.commitWorkingCopy(draft.id as any);
    expect(res.success).toBe(true);

    // Assert: committed node exists under canonical node id
    const committed = await core.nodes.get(expectedNodeId);
    expect(committed).toBeTruthy();
    expect(res.node?.id).toBe(expectedNodeId);
    expect(res.node?.name).toBe(committed?.name);
    // Parent should not be a workingCopy holder after commit
    const parent = await core.nodes.get(committed!.parentId as any);
    expect(parent?.nodeType).not.toBe('workingCopy');
  });

  it('returns canonical nodeId when committing a draft working copy', async () => {
    const parentId = 'r:root' as any;
    const draft = await wc.createDraftWorkingCopy('folder' as any, parentId, { name: 'Draft Canonical' } as any);
    const holder = await core.nodes.get(draft.parentId as any);
    expect(holder).toBeTruthy();
    const expectedNodeId = (holder as any).holderTargetId;
    expect(typeof expectedNodeId).toBe('string');

    const env = cp.createEnvelope('commitWorkingCopy', { workingCopyId: draft.id as any, onNameConflict: 'auto-rename' });
    const result = await cp.processCommand(env as any);

    expect(result.success).toBe(true);
    expect(result.nodeId).toBe(expectedNodeId);

    const committed = await core.nodes.get(expectedNodeId);
    expect(committed).toBeTruthy();
  });

  it('auto-rename draft commit returns updated node payload', async () => {
    const parentId = 'r:root' as any;
    const baseName = 'Auto Rename';

    const first = await wc.createDraftWorkingCopy('folder' as any, parentId, { name: baseName } as any);
    const firstHolder = await core.nodes.get(first.parentId as any);
    const firstExpected = (firstHolder as any)?.holderTargetId;
    expect(typeof firstExpected).toBe('string');
    const firstRes = await wc.commitWorkingCopy(first.id as any);
    expect(firstRes.success).toBe(true);

    const committedFirst = await core.nodes.get(firstExpected);
    expect(committedFirst?.name).toBe(baseName);

    const second = await wc.createDraftWorkingCopy('folder' as any, parentId, { name: baseName } as any);
    const secondHolder = await core.nodes.get(second.parentId as any);
    const secondExpected = (secondHolder as any)?.holderTargetId;
    expect(typeof secondExpected).toBe('string');

    const res = await wc.commitWorkingCopy(second.id as any);
    expect(res.success).toBe(true);
    expect(res.node).toBeTruthy();
    expect(res.node?.id).toBe(secondExpected);
    expect(res.node?.name).not.toBe(baseName);

    const stored = await core.nodes.get(secondExpected);
    expect(stored?.name).toBe(res.node?.name);
  });
});
