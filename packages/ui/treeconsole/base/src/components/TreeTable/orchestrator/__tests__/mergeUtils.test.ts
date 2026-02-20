import { describe, it, expect } from 'vitest';
import type { SubTreeChanges } from '../../state/features/subscription.atoms';
import { coalesceBatches } from '../mergeUtils';

describe('coalesceBatches', () => {
  it('coalesces added/updated/removed/moved with last-write-wins', () => {
    const batches: SubTreeChanges[] = [
      { added: [{ id: 'a', parentId: null }] },
      { updated: [{ nodeId: 'a', changes: { name: 'A1' } }] },
      { moved: [{ nodeId: 'a', newParentId: 'r' }] },
      { removed: ['b'] },
      { updated: [{ nodeId: 'a', changes: { description: 'D' } }] },
    ];
    const r = coalesceBatches(batches);
    expect(r.removed).toEqual(['b']);
    const u = (r.updated || []).find((x) => x.nodeId === 'a');
    expect(u?.changes).toMatchObject({ name: 'A1', description: 'D' });
    const m = (r.moved || []).find((x) => x.nodeId === 'a');
    expect(m?.newParentId).toBe('r');
  });
});

