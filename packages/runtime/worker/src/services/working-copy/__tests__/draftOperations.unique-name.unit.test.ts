import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { CoreDB } from '../../CoreDB.js';
import { createDraftWorkingCopy } from '../draftOperations.js';

describe('createDraftWorkingCopy - default name uniqueness', () => {
  const treeId = 'tree' as TreeId;
  const parentId = `${treeId}:parent` as NodeId;
  let core: CoreDB;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${treeId}-wc-unique`);
    const now = Date.now();
    await core.nodes.bulkPut([
      {
        id: parentId,
        parentId: `${treeId}:root` as NodeId,
        name: 'Parent',
        nodeType: 'folder' as NodeType,
        data: {},
        draftData: null,
        depth: 1,
        createdAt: now,
        updatedAt: now,
        version: 1,
        lastTouchedAt: now,
      },
      {
        id: `${parentId}:child1` as NodeId,
        parentId,
        name: 'New Folder',
        nodeType: 'folder' as NodeType,
        data: {},
        draftData: null,
        depth: 2,
        createdAt: now,
        updatedAt: now,
        version: 1,
        lastTouchedAt: now,
      },
    ]);
  });

  afterEach(() => {
    CoreDB.resetInstance();
  });

  it('auto-increments the default name when a sibling with the base name exists', async () => {
    const wcNodeId = await createDraftWorkingCopy(
      core,
      treeId,
      parentId,
      'folder' as NodeType,
      'New Folder'
    );

    const wc = (await core.nodes.get(wcNodeId)) as TreeNode | undefined;
    expect(wc?.name).toBe('New Folder (2)');
    expect((wc?.data as { name?: string } | undefined)?.name).toBe('New Folder (2)');
  });
});
