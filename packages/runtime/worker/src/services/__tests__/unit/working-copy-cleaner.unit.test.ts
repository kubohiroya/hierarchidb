import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NodeId, NodeType, TreeId, Timestamp } from '@hierarchidb/common-types';
import { CoreDB } from '../../CoreDB.js';
import {
  createDraftWorkingCopyGetOrCreate,
  touchWorkingCopyNodes,
} from '../../WorkingCopyTreeNodeOperations.js';
import { getWorkingCopyCleaner } from '../../WorkingCopyCleaner.js';

const TREE_ID = 'r' as TreeId;
const PARENT_ID = 'r:root' as NodeId;
const NODE_TYPE = 'folder' as NodeType;

describe('WorkingCopyCleaner', () => {
  beforeEach(() => {
    CoreDB.resetInstance();
  });

  it('removes stale working copies that exceed TTL', async () => {
    const core = await CoreDB.getSingleton();
    const { wcHolderId, wcNodeId } = await createDraftWorkingCopyGetOrCreate(
      core,
      TREE_ID,
      PARENT_ID,
      NODE_TYPE,
      'Draft'
    );

    const staleTimestamp = (Date.now() - 10_000) as Timestamp;
    await touchWorkingCopyNodes(core, wcHolderId, wcNodeId, staleTimestamp);

    const cleaner = getWorkingCopyCleaner(core, { ttlMs: 5_000, intervalMs: 0, batchSize: 10 });
    const removed = await cleaner.cleanStaleEntries();

    expect(removed).toBe(1);
    expect(await core.nodes.get(wcHolderId)).toBeUndefined();
    expect(await core.nodes.get(wcNodeId)).toBeUndefined();
  });

  it('respects maxEntries hints during cleanup', async () => {
    const core = await CoreDB.getSingleton();

    const pairs = await Promise.all(
      Array.from({ length: 3 }).map((_, idx) =>
        createDraftWorkingCopyGetOrCreate(
          core,
          TREE_ID,
          (PARENT_ID + idx) as NodeId,
          NODE_TYPE,
          `Draft-${idx}`
        )
      )
    );

    const staleTimestamp = (Date.now() - 10_000) as Timestamp;
    for (const pair of pairs) {
      await touchWorkingCopyNodes(core, pair.wcHolderId, pair.wcNodeId, staleTimestamp);
    }

    const cleaner = getWorkingCopyCleaner(core, { ttlMs: 5_000, intervalMs: 0, batchSize: 10 });
    const firstPass = await cleaner.cleanStaleEntries({ maxEntries: 2 });
    expect(firstPass).toBe(2);
    const secondPass = await cleaner.cleanStaleEntries();
    expect(secondPass).toBe(1);
  });
});
