import type { TreeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  buildMenuItemsForContext,
  buildMenuItemsForTreeId,
  type PluginMenuItem,
} from '../../menu-builders.js';
import { getMenuSpec } from '../../menu-spec.ts';

describe('menu-builders', () => {
  it('maps treeId to context implicitly in buildMenuItemsForTreeId', () => {
    const r = buildMenuItemsForTreeId('r' as TreeId);
    const t = buildMenuItemsForTreeId('t' as TreeId);
    const p = buildMenuItemsForTreeId('p' as TreeId);
    expect(r.length).toBeGreaterThan(0);
    expect(t.length).toBeGreaterThan(0);
    expect(p.map((i: PluginMenuItem) => i.nodeType)).toEqual(
      t.map((i: PluginMenuItem) => i.nodeType)
    );
  });

  it('builds resources (r) menu in specified order and groups', () => {
    const items = buildMenuItemsForTreeId('r' as TreeId);
    const spec = getMenuSpec('resources');
    const nodeTypes = items.map((i: PluginMenuItem) => i.nodeType);
    expect(nodeTypes).toEqual(spec.order);

    const groups = items.map((i) => i.group);
    const expectedGroups = items.map((item) => spec.groupOf[item.nodeType]);
    expect(groups).toEqual(expectedGroups);
  });

  it('builds projects (t) menu in specified order and groups', () => {
    const items = buildMenuItemsForTreeId('t' as TreeId);
    const spec = getMenuSpec('projects');
    const nodeTypes = items.map((i) => i.nodeType);
    expect(nodeTypes).toEqual(spec.order);
    const groups = items.map((i) => i.group);
    const expectedGroups = items.map((item) => spec.groupOf[item.nodeType]);
    expect(groups).toEqual(expectedGroups);
  });

  it('builds by context explicitly and matches treeId mapping', () => {
    const rByContext = buildMenuItemsForContext('resources');
    const rByTreeId = buildMenuItemsForTreeId('r' as TreeId);
    expect(rByContext.map((i) => i.nodeType)).toEqual(rByTreeId.map((i) => i.nodeType));

    const pByContext = buildMenuItemsForContext('projects');
    const tByTreeId = buildMenuItemsForTreeId('t' as TreeId);
    expect(pByContext.map((i) => i.nodeType)).toEqual(tByTreeId.map((i) => i.nodeType));
  });

  it('provides folder template submenu entries for resources context', () => {
    const items = buildMenuItemsForTreeId('r' as TreeId);
    const folderItem = items.find((item) => item.nodeType === 'folder');
    expect(folderItem).toBeDefined();
    const createTypes = (folderItem?.children ?? []).map((child) => child.createType);
    expect(createTypes).toContain('folder::template:population-2023');
  });

  it('omits resources-only folder templates in projects context', () => {
    const items = buildMenuItemsForTreeId('t' as TreeId);
    const folderItem = items.find((item) => item.nodeType === 'folder');
    const createTypes = (folderItem?.children ?? []).map((child) => child.createType);
    expect(createTypes).not.toContain('folder::template:population-2023');
  });
});
