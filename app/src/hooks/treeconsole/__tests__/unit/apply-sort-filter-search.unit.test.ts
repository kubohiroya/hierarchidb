/**
 * TreeConsole sort/filter helper tests.
 *
 * Verifies ordering, filtering, and search behaviour for applySortFilterSearch.
 */

import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { describe, expect, it } from 'vitest';
import { applySortFilterSearch } from '../../sortFilter.js';

const baseNode = (
  id: string,
  name: string,
  nodeType: string,
  description = ''
): HierarchicalTreeNode => ({
  id: id as unknown as NodeId,
  parentId: 'r:root' as unknown as NodeId,
  nodeType: nodeType as unknown as NodeType,
  metadata: { name, description, tags: [] },
  draftMetadata: null,
  data: null,
  draftData: undefined,
  depth: 1,
  visible: true,
  createdAt: Date.now() as Timestamp,
  updatedAt: Date.now() as Timestamp,
  version: 1,
});

const sampleNodes: HierarchicalTreeNode[] = [
  baseNode('1', 'Alpha', 'folder'),
  baseNode('2', 'beta', 'basemap'),
  baseNode('3', 'Gamma', 'folder'),
  baseNode('4', 'delta', 'shape', 'preview'),
];

describe('applySortFilterSearch', () => {
  it('sorts alphabetically by default ascending', () => {
    const sorted = applySortFilterSearch(sampleNodes, {
      sortBy: 'name',
      sortDirection: 'asc',
      filterBy: '',
      searchTerm: '',
    });
    expect(sorted.map((n) => n.metadata.name)).toEqual(['Alpha', 'beta', 'delta', 'Gamma']);
  });

  it('sorts descending when specified', () => {
    const sorted = applySortFilterSearch(sampleNodes, {
      sortBy: 'name',
      sortDirection: 'desc',
      filterBy: '',
      searchTerm: '',
    });
    expect(sorted.map((n) => n.metadata.name)).toEqual(['Gamma', 'delta', 'beta', 'Alpha']);
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
