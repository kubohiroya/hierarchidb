import { describe, expect, it } from 'vitest';
import {
  applyDirectStyleBindingPaint,
  type DirectStyleBindingSource,
  resolveDirectStyleBindingTargets,
} from '../resolveDirectStyleBindings.js';

const styler: DirectStyleBindingSource = {
  nodeId: 'styler-1',
  enabled: true,
  colorStops: [
    { key: 'a', color: '#ff0000' },
    { key: 'b', color: '#00ff00' },
  ],
  scalarStops: [
    { key: 'a', scalarValue: 0.4 },
    { key: 'b', scalarValue: 0.9 },
  ],
};

const nodeTypes = new Map([
  ['shape-1', 'shape'],
  ['location-1', 'location'],
  ['route-1', 'route'],
  ['folder-1', 'folder'],
  ['folder-2', 'folder'],
  ['folder-3', 'folder'],
  ['basemap-1', 'basemap'],
]);

const targetNodes = new Map([
  ['folder-1', { id: 'folder-1', nodeType: 'folder', parentId: 'root' }],
  ['folder-2', { id: 'folder-2', nodeType: 'folder', parentId: 'folder-1' }],
  ['folder-3', { id: 'folder-3', nodeType: 'folder', parentId: 'folder-1' }],
  ['shape-1', { id: 'shape-1', nodeType: 'shape', parentId: 'folder-1' }],
  ['location-1', { id: 'location-1', nodeType: 'location', parentId: 'folder-2' }],
  ['route-1', { id: 'route-1', nodeType: 'route', parentId: 'folder-2' }],
  ['basemap-1', { id: 'basemap-1', nodeType: 'basemap', parentId: 'folder-1' }],
]);

const baseBinding = {
  version: 1,
  bindingId: 'binding-1',
  stylerNodeId: 'styler-1',
  sourceKeyColumn: 'id',
  targetKeyProperty: 'id',
  enabled: true,
};

describe('resolver style bindings for map layers', () => {
  it('applies Shape fill styles from direct bindings', () => {
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          targetNodeId: 'shape-1',
          targetKind: 'shape',
          styleProperties: ['fillColor', 'opacity'],
        },
      ],
      styleSources: [styler],
      targetNodeTypesById: nodeTypes,
    });

    const paint = applyDirectStyleBindingPaint(
      'fill',
      { 'fill-color': '#cccccc' },
      targets.get('shape-1')
    );

    expect(paint).toMatchObject({
      'fill-color': [
        'match',
        ['to-string', ['get', 'id']],
        'a',
        '#ff0000',
        'b',
        '#00ff00',
        '#cccccc',
      ],
      'fill-opacity': ['match', ['to-string', ['get', 'id']], 'a', 0.4, 'b', 0.9, 0.3],
    });
  });

  it('applies Location circle styles from direct bindings', () => {
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          targetNodeId: 'location-1',
          targetKind: 'location',
          styleProperties: ['strokeColor', 'radius'],
        },
      ],
      styleSources: [styler],
      targetNodeTypesById: nodeTypes,
    });

    const paint = applyDirectStyleBindingPaint(
      'circle',
      { 'circle-color': '#3366ff', 'circle-radius': 5 },
      targets.get('location-1')
    );

    expect(paint).toMatchObject({
      'circle-color': [
        'match',
        ['to-string', ['get', 'id']],
        'a',
        '#ff0000',
        'b',
        '#00ff00',
        '#3366ff',
      ],
      'circle-radius': ['match', ['to-string', ['get', 'id']], 'a', 0.4, 'b', 0.9, 5],
    });
  });

  it('applies Route line styles from direct bindings', () => {
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          targetNodeId: 'route-1',
          targetKind: 'route',
          styleProperties: ['strokeColor', 'strokeWidth'],
        },
      ],
      styleSources: [styler],
      targetNodeTypesById: nodeTypes,
    });

    const paint = applyDirectStyleBindingPaint(
      'line',
      { 'line-color': '#f24c3d', 'line-width': 2 },
      targets.get('route-1')
    );

    expect(paint).toMatchObject({
      'line-color': [
        'match',
        ['to-string', ['get', 'id']],
        'a',
        '#ff0000',
        'b',
        '#00ff00',
        '#f24c3d',
      ],
      'line-width': ['match', ['to-string', ['get', 'id']], 'a', 0.4, 'b', 0.9, 2],
    });
  });

  it('preserves base paint when no binding is configured', () => {
    const basePaint = { 'line-color': '#f24c3d' };

    expect(applyDirectStyleBindingPaint('line', basePaint, undefined)).toBe(basePaint);
  });

  it('ignores unresolved or invalid bindings', () => {
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          targetNodeId: 'shape-1',
          targetKind: 'route',
          styleProperties: ['strokeColor'],
        },
        {
          ...baseBinding,
          bindingId: 'binding-2',
          targetNodeId: 'route-1',
          targetKind: 'route',
          styleProperties: ['strokeColor'],
          stylerNodeId: 'missing-styler',
        },
        {
          ...baseBinding,
          bindingId: 'binding-3',
          targetNodeId: 'location-1',
          targetKind: 'location',
          styleProperties: ['fillColor'],
        },
      ],
      styleSources: [styler],
      targetNodeTypesById: nodeTypes,
    });

    expect(targets.size).toBe(0);
  });

  it('expands direct child Folder scope only to immediate feature targets', () => {
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          targetNodeId: 'folder-1',
          targetKind: 'folder',
          scopeMode: 'direct-children',
          styleProperties: ['fillColor', 'strokeColor'],
        },
      ],
      styleSources: [styler],
      targetNodesById: targetNodes,
    });

    expect(targets.has('shape-1')).toBe(true);
    expect(targets.has('location-1')).toBe(false);
    expect(targets.has('route-1')).toBe(false);
  });

  it('expands recursive Folder scope to supported descendants', () => {
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          targetNodeId: 'folder-1',
          targetKind: 'folder',
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        },
      ],
      styleSources: [styler],
      targetNodesById: targetNodes,
    });

    expect([...targets.keys()].sort()).toEqual(['location-1', 'route-1', 'shape-1']);
  });

  it('keeps direct target binding precedence over Folder scope binding', () => {
    const folderStyler: DirectStyleBindingSource = {
      ...styler,
      nodeId: 'styler-2',
      colorStops: [{ key: 'a', color: '#0000ff' }],
    };
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          bindingId: 'folder-binding',
          stylerNodeId: 'styler-2',
          targetNodeId: 'folder-1',
          targetKind: 'folder',
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        },
        {
          ...baseBinding,
          bindingId: 'direct-binding',
          targetNodeId: 'route-1',
          targetKind: 'route',
          styleProperties: ['strokeColor'],
        },
      ],
      styleSources: [styler, folderStyler],
      targetNodesById: targetNodes,
    });

    const paint = applyDirectStyleBindingPaint(
      'line',
      { 'line-color': '#f24c3d' },
      targets.get('route-1')
    );

    expect(paint?.['line-color']).toEqual([
      'match',
      ['to-string', ['get', 'id']],
      'a',
      '#ff0000',
      'b',
      '#00ff00',
      '#f24c3d',
    ]);
  });

  it('keeps deeper Folder scope precedence over shallower Folder scope binding', () => {
    const shallowStyler: DirectStyleBindingSource = {
      ...styler,
      nodeId: 'styler-2',
      colorStops: [{ key: 'a', color: '#0000ff' }],
    };
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          bindingId: 'shallow-folder-binding',
          stylerNodeId: 'styler-2',
          targetNodeId: 'folder-1',
          targetKind: 'folder',
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        },
        {
          ...baseBinding,
          bindingId: 'deep-folder-binding',
          targetNodeId: 'folder-2',
          targetKind: 'folder',
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        },
      ],
      styleSources: [styler, shallowStyler],
      targetNodesById: targetNodes,
    });

    const paint = applyDirectStyleBindingPaint(
      'line',
      { 'line-color': '#f24c3d' },
      targets.get('route-1')
    );

    expect(paint?.['line-color']).toEqual([
      'match',
      ['to-string', ['get', 'id']],
      'a',
      '#ff0000',
      'b',
      '#00ff00',
      '#f24c3d',
    ]);
  });

  it('fails closed for same-depth Folder scope conflicts', () => {
    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          bindingId: 'folder-binding-1',
          targetNodeId: 'folder-1',
          targetKind: 'folder',
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        },
        {
          ...baseBinding,
          bindingId: 'folder-binding-2',
          targetNodeId: 'folder-1',
          targetKind: 'folder',
          scopeMode: 'recursive-descendants',
          styleProperties: ['strokeColor'],
        },
      ],
      styleSources: [styler],
      targetNodesById: targetNodes,
    });

    expect(targets.has('route-1')).toBe(false);
  });

  it('ignores unsupported and deleted Folder descendants', () => {
    const scopedNodes = new Map([
      ...targetNodes,
      [
        'deleted-route',
        { id: 'deleted-route', nodeType: 'route', parentId: 'folder-1', removedAt: 1 },
      ],
    ]);

    const targets = resolveDirectStyleBindingTargets({
      bindings: [
        {
          ...baseBinding,
          targetNodeId: 'folder-1',
          targetKind: 'folder',
          scopeMode: 'direct-children',
          styleProperties: ['strokeColor'],
        },
      ],
      styleSources: [styler],
      targetNodesById: scopedNodes,
    });

    expect(targets.has('basemap-1')).toBe(false);
    expect(targets.has('deleted-route')).toBe(false);
  });
});
