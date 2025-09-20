/**
 * TreeConsole sort/filter helper tests.
 *
 * Verifies ordering, filtering, and search behaviour for applySortFilterSearch.
 */

import { describe, expect, it } from 'vitest';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import { applySortFilterSearch } from '../treeconsole/sortFilter.js';

const sampleNodes: TreeNodeData[] = [
  { id: '1', name: 'Alpha', nodeType: 'folder' } as TreeNodeData,
  { id: '2', name: 'beta', nodeType: 'basemap' } as TreeNodeData,
  { id: '3', name: 'Gamma', nodeType: 'folder' } as TreeNodeData,
  { id: '4', name: 'delta', nodeType: 'shape', description: 'preview' } as TreeNodeData,
];

describe('applySortFilterSearch', () => {
  it('sorts alphabetically by default ascending', () => {
    const sorted = applySortFilterSearch(sampleNodes, {
      sortBy: 'name',
      sortDirection: 'asc',
      filterBy: '',
      searchTerm: '',
    });
    expect(sorted.map((n) => n.name)).toEqual(['Alpha', 'beta', 'delta', 'Gamma']);
  });

  it('sorts descending when specified', () => {
    const sorted = applySortFilterSearch(sampleNodes, {
      sortBy: 'name',
      sortDirection: 'desc',
      filterBy: '',
      searchTerm: '',
    });
    expect(sorted.map((n) => n.name)).toEqual(['Gamma', 'delta', 'beta', 'Alpha']);
  });

  it('filters by nodeType and applies search term', () => {
    const sorted = applySortFilterSearch(sampleNodes, {
      sortBy: 'name',
      sortDirection: 'asc',
      filterBy: 'folder',
      searchTerm: 'a',
    });
    expect(sorted.map((n) => n.id)).toEqual(['1', '3']);
  });
});
