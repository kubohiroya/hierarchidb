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
});
