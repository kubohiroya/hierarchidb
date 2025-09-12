import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { CoreDB } from '../CoreDB';
import { CommandProcessor } from '../CommandProcessor';
import { WorkingCopyService } from '../WorkingCopyService';

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
    const res = await wc.commitWorkingCopy(draft.id as any);
    expect(res.success).toBe(true);

    // Assert: committed node should no longer be under workingCopy holder
    const committed = await core.nodes.get(draft.id as any);
    expect(committed).toBeTruthy();
    // Parent should not be a workingCopy holder after commit
    const parent = await core.nodes.get(committed!.parentId as any);
    expect(parent?.nodeType).not.toBe('workingCopy');
  });
});

