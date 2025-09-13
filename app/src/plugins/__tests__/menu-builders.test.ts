import { TreeId } from '@hierarchidb/common-type';
import { describe, it, expect } from 'vitest';
import { buildMenuItemsForContext, buildMenuItemsForTreeId } from '~/plugins/menu-builders';

describe('menu-builders', () => {
  it('maps treeId to context implicitly in buildMenuItemsForTreeId', () => {
    const r = buildMenuItemsForTreeId('r' as TreeId);
    const t = buildMenuItemsForTreeId('t' as TreeId);
    const p = buildMenuItemsForTreeId('p' as TreeId);
    expect(r.length).toBeGreaterThan(0);
    expect(t.length).toBeGreaterThan(0);
    expect(p.map((i) => i.nodeType)).toEqual(t.map((i) => i.nodeType));
  });

  it('builds resources (r) menu in specified order and groups', () => {
    const items = buildMenuItemsForTreeId('r' as TreeId);
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
    const items = buildMenuItemsForTreeId('t' as TreeId);
    const nodeTypes = items.map((i) => i.nodeType);
    expect(nodeTypes).toEqual(['folder', 'project']);
    const groups = items.map((i) => i.group);
    expect(groups).toEqual(['core', 'project']);
  });

  it('builds by context explicitly and matches treeId mapping', () => {
    const rByContext = buildMenuItemsForContext('resources');
    const rByTreeId = buildMenuItemsForTreeId('r' as TreeId);
    expect(rByContext.map((i) => i.nodeType)).toEqual(rByTreeId.map((i) => i.nodeType));

    const pByContext = buildMenuItemsForContext('projects');
    const tByTreeId = buildMenuItemsForTreeId('t' as TreeId);
    expect(pByContext.map((i) => i.nodeType)).toEqual(tByTreeId.map((i) => i.nodeType));
  });
});
