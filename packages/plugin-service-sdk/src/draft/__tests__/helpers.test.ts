import { describe, expect, it } from 'vitest';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { DraftBase } from '@hierarchidb/plugin-service-api';
import { createEntityDraftAdapter } from '../adapter';

interface Entity {
  title: string;
  version: number;
  nested?: { value: number };
}

describe('draft helpers', () => {
  const adapter = createEntityDraftAdapter<Entity, DraftBase<Entity>>({
    draftFromEntity: (entity) => ({ ...entity }),
    draftDefaults: (_treeNodeId, overrides) => ({
      title: 'Initial title',
      nested: { value: 1 },
      ...overrides,
    }),
  });

  it('creates a draft state with provided metadata intact', () => {
    const draft = adapter.createDraft('node-123' as NodeId, {
      title: 'Initial title',
      nested: { value: 1 },
      createdAt: 1000 as Timestamp,
      updatedAt: 1000 as Timestamp,
      version: 7,
    });

    expect(draft.treeNodeId).toBe('node-123');
    expect(draft.draft.title).toBe('Initial title');
    expect(draft.draft.nested).toEqual({ value: 1 });
    expect(draft.createdAt).toBe(1000 as Timestamp);
    expect(draft.updatedAt).toBe(1000 as Timestamp);
    expect(draft.originalVersion).toBe(7);
  });

  it('updates a draft state and merges changes', () => {
    const draft: DraftBase<Entity> = adapter.createDraft('node-789' as NodeId, {
      title: 'Initial title',
      nested: { value: 2 },
      createdAt: 2000 as Timestamp,
      updatedAt: 2000 as Timestamp,
    }) as DraftBase<Entity>;

    const updatedAt = 3000 as Timestamp;
    const updatedCopy = adapter.merge(draft as DraftBase<Entity>, { title: 'Updated title', version: 2 }, updatedAt);

    expect(updatedCopy.draft.title).toBe('Updated title');
    expect(updatedCopy.draft.version).toBe(2);
    expect(updatedCopy.updatedAt).toBe(updatedAt);
  });
});
