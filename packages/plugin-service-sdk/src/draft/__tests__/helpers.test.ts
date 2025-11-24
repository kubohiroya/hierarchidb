import { describe, expect, it } from 'vitest';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { createDraftBase, markDraftUpdated } from '../helpers.js';
import type { DraftBase } from '@hierarchidb/plugin-service-api';

interface Entity {
  title: string;
  version: number;
  nested?: { value: number };
}

describe('working copy helpers', () => {
  it('creates a draft working copy with provided metadata intact', () => {
    const draftPayload: Partial<Entity> = {
      title: 'Initial title',
      nested: { value: 1 },
    };

    const createdAt = 1000 as Timestamp;
    const updatedAt = 1000 as Timestamp;
    const base = createDraftBase<Entity>({
      draft: draftPayload,
      meta: {
        treeNodeId: 'node-123' as NodeId,
        createdAt,
        updatedAt,
        originalVersion: 7,
      },
    });

    const draft: DraftBase<Entity> = {
      ...base,
      ...draftPayload,
    };

    expect(draft.treeNodeId).toBe('node-123');
    expect(draft.draft).toEqual(draftPayload);
    expect(draft.createdAt).toBe(createdAt);
    expect(draft.updatedAt).toBe(updatedAt);
    expect(draft.originalVersion).toBe(7);
  });

  it('updates a draft working copy and merges changes', () => {
    const draft: DraftBase<Entity> = {
      ...createDraftBase<Entity>({
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
    };

    const updatedAt = 3000 as Timestamp;
    const updatedCopy = markDraftUpdated(draft, { title: 'Updated title', version: 2 }, updatedAt);

    expect(updatedCopy.draft.title).toBe('Updated title');
    expect(updatedCopy.draft.version).toBe(2);
    expect(updatedCopy.updatedAt).toBe(updatedAt);
  });
});
