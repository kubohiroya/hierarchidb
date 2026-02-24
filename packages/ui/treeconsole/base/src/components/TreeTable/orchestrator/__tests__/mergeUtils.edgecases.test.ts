import { describe, it, expect } from 'vitest';
import type { SubTreeChanges } from '../../state/features/subscription.atoms';
import { coalesceBatches } from '../mergeUtils';

describe('coalesceBatches edge cases', () => {
  it('drops updates/moves for nodes that are later removed', () => {
    const changes: SubTreeChanges[] = [
      { updated: [{ nodeId: 'x', changes: { name: 'X1' } }] },
      { moved: [{ nodeId: 'x', newParentId: 'r' }] },
      { removed: ['x'] },
    ];
    const r = coalesceBatches(changes);
    expect(r.removed).toEqual(['x']);
    expect(r.updated?.some(u => u.nodeId === 'x')).toBeFalsy();
    expect(r.moved?.some(m => m.nodeId === 'x')).toBeFalsy();
  });

  it('last write wins across multiple updates and moves', () => {
    const changes: SubTreeChanges[] = [
      { added: [{ id: 'a', parentId: 'p1' }] },
      { updated: [{ nodeId: 'a', changes: { name: 'N1' } }] },
      { moved: [{ nodeId: 'a', newParentId: 'p2' }] },
      { updated: [{ nodeId: 'a', changes: { desc: 'D1' } }] },
      { moved: [{ nodeId: 'a', newParentId: 'p3' }] },
      { updated: [{ nodeId: 'a', changes: { name: 'N2' } }] },
    ];
    const r = coalesceBatches(changes);
    const u = r.updated?.find(x => x.nodeId === 'a');
    expect(u?.changes).toMatchObject({ name: 'N2', desc: 'D1' });
    const m = r.moved?.find(x => x.nodeId === 'a');
    expect(m?.newParentId).toBe('p3');
  });

  it('remove after add cancels the add and yields only removed', () => {
    const r = coalesceBatches([
      { added: [{ id: 'n', parentId: 'p' }] },
      { removed: ['n'] },
    ]);
    expect(r.added?.some((a) => a.id === 'n')).toBeFalsy();
    expect(r.removed).toEqual(['n']);
  });
});
