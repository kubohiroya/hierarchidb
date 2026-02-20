import { describe, expect, it } from 'vitest';
import { DualKeyMap } from '../dualKeyMap';

type Primary = string;
type Secondary = string;

describe('DualKeyMap', () => {
  it('stores and retrieves values by primary key', () => {
    const map = new DualKeyMap<Primary, Secondary, number>();
    map.set('a', 1, 'root');
    map.set('b', 2, 'root');

    expect(map.size).toBe(2);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
    expect(map.getSecondaryKey('a')).toBe('root');
    expect(map.getSecondaryKey('missing')).toBeUndefined();
  });

  it('tracks secondary index membership', () => {
    const map = new DualKeyMap<Primary, Secondary, string>();
    map.set('folder-1', 'Folder 1', 'root');
    map.set('folder-2', 'Folder 2', 'root');
    map.set('child-1', 'Child 1', 'folder-1');

    expect(map.hasSecondary('root')).toBe(true);
    expect(map.hasSecondary('folder-1')).toBe(true);
    expect(map.hasSecondary('unknown')).toBe(false);

    const primaryKeys = map.getPrimaryKeysBySecondary('root');
    expect(Array.from(primaryKeys).sort()).toEqual(['folder-1', 'folder-2']);

    const values = map.getValuesBySecondary('root');
    expect(values.sort()).toEqual(['Folder 1', 'Folder 2']);

    // Returned sets should be copies
    if (primaryKeys instanceof Set) {
      primaryKeys.add('mutated' as Primary);
    }
    expect(map.getPrimaryKeysBySecondary('root')).not.toContain('mutated' as Primary);
  });

  it('updates secondary membership when the association changes', () => {
    const map = new DualKeyMap<Primary, Secondary, string>();
    map.set('node-1', 'Node 1', 'parent-a');
    map.set('node-2', 'Node 2', 'parent-a');

    map.set('node-1', 'Node 1 updated', 'parent-b');

    expect(map.get('node-1')).toBe('Node 1 updated');
    expect(map.getSecondaryKey('node-1')).toBe('parent-b');
    expect(map.getPrimaryKeysBySecondary('parent-a')).toEqual(new Set(['node-2']));
    expect(map.getPrimaryKeysBySecondary('parent-b')).toEqual(new Set(['node-1']));
  });

  it('removes entries cleanly', () => {
    const map = new DualKeyMap<Primary, Secondary, string>();
    map.set('node-1', 'Node 1', 'parent-a');
    map.set('node-2', 'Node 2', 'parent-a');

    expect(map.delete('node-1')).toBe(true);
    expect(map.hasPrimary('node-1')).toBe(false);
    expect(map.getPrimaryKeysBySecondary('parent-a')).toEqual(new Set(['node-2']));

    expect(map.delete('node-2')).toBe(true);
    expect(map.hasSecondary('parent-a')).toBe(false);
    expect(map.delete('missing' as Primary)).toBe(false);
  });

  it('clears all entries', () => {
    const map = new DualKeyMap<Primary, Secondary, string>();
    map.set('node-1', 'Node 1', 'parent-a');
    map.set('node-2', 'Node 2', 'parent-b');

    map.clear();
    expect(map.size).toBe(0);
    expect(map.hasSecondary('parent-a')).toBe(false);
    expect(map.get('node-1')).toBeUndefined();
  });
});
