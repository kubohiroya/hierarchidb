import { describe, expect, it } from 'vitest';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { createDraftWorkingCopyBase, markWorkingCopyUpdated } from '../helpers.js';
import type { WorkingCopyDraft } from '../types.js';

interface Entity {
  title: string;
  version: number;
  nested?: { value: number };
}

describe('working copy helpers', () => {
  it('creates a draft working copy with provided metadata intact', () => {
    const draft: Partial<Entity> = {
      title: 'Initial title',
      nested: { value: 1 },
    };

    const createdAt = 1000 as Timestamp;
    const updatedAt = 1000 as Timestamp;
    const base = createDraftWorkingCopyBase<Entity>({
      draft,
      meta: {
        treeNodeId: 'node-123' as NodeId,
        createdAt,
        updatedAt,
        originalVersion: 7,
      },
    });

    const workingCopy: WorkingCopyDraft<Entity> = {
      ...draft,
      ...base,
    };

    expect(workingCopy.treeNodeId).toBe('node-123');
    expect(workingCopy.draft).toEqual(draft);
    expect(workingCopy.createdAt).toBe(createdAt);
    expect(workingCopy.updatedAt).toBe(updatedAt);
    expect(workingCopy.originalVersion).toBe(7);
  });

  it('updates a draft working copy and merges changes', () => {
    const draftCopy: WorkingCopyDraft<Entity> = {
      ...createDraftWorkingCopyBase<Entity>({
        draft: {
          title: 'Initial title',
          nested: { value: 2 },
        },
        meta: {
          treeNodeId: 'node-789' as NodeId,
          createdAt: 2000 as Timestamp,
          updatedAt: 2000 as Timestamp,
        },
      }),
      title: 'Initial title',
      nested: { value: 2 },
    };

    const updatedAt = 3000 as Timestamp;
    const updatedCopy = markWorkingCopyUpdated(draftCopy, { title: 'Updated title', version: 2 }, updatedAt);

    expect(updatedCopy.draft.title).toBe('Updated title');
    expect(updatedCopy.draft.version).toBe(2);
    expect(updatedCopy.title).toBe('Updated title');
    expect(updatedCopy.version).toBe(2);
    expect(updatedCopy.updatedAt).toBe(updatedAt);
  });
});
