import { describe, it, expect } from 'vitest';
import {
  buildMenuItemsForContext,
  buildMenuItemsForTreeId,
  normalizeContextFromTreeId,
  type TreeContext,
} from '~/plugins/menu-builders';

describe('menu-builders', () => {
  it('normalizes treeId to context', () => {
    expect(normalizeContextFromTreeId('r')).toBe('resources');
    expect(normalizeContextFromTreeId('t')).toBe('projects');
    expect(normalizeContextFromTreeId('p')).toBe('projects');
    expect(normalizeContextFromTreeId(undefined)).toBe('resources');
  });

  it('builds resources (r) menu in specified order and groups', () => {
    const items = buildMenuItemsForTreeId('r');
    const nodeTypes = items.map((i) => i.nodeType);
    expect(nodeTypes).toEqual([
      'folder',
      'basemap',
      'shape',
      'location',
      'route',
      'spreadsheet',
      'styler',
      'resolver',
    ]);

    const groups = items.map((i) => i.group);
    expect(groups).toEqual([
      'core', // folder
      'base', // basemap
      'geo', // shape
      'geo', // location
      'geo', // route
      'tabular', // spreadsheet
      'tabular', // styler
      'tabular', // resolver
    ]);
  });

  it('builds projects (t) menu in specified order and groups', () => {
    const items = buildMenuItemsForTreeId('t');
    const nodeTypes = items.map((i) => i.nodeType);
    expect(nodeTypes).toEqual(['folder', 'project']);
    const groups = items.map((i) => i.group);
    expect(groups).toEqual(['core', 'project']);
  });

  it('builds by context explicitly and matches treeId mapping', () => {
    const rByContext = buildMenuItemsForContext('resources');
    const rByTreeId = buildMenuItemsForTreeId('r');
    expect(rByContext.map((i) => i.nodeType)).toEqual(rByTreeId.map((i) => i.nodeType));

    const pByContext = buildMenuItemsForContext('projects');
    const tByTreeId = buildMenuItemsForTreeId('t');
    expect(pByContext.map((i) => i.nodeType)).toEqual(tByTreeId.map((i) => i.nodeType));
  });
});

