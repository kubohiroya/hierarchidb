import type { MapLibreStyle } from '@hierarchidb/ui-map';
import { describe, expect, it } from 'vitest';
import {
  buildAbsolutePath,
  collectOrderedNodesByType,
  combineStylerStyleSpecs,
  getNonOverlappingBranchRoots,
  type TreeNodeLike,
} from '../../resourceTreeOrdering';

const createNodeMap = (nodes: TreeNodeLike[]): Map<string, TreeNodeLike> =>
  new Map(nodes.map((node) => [String(node.id), node]));

const nodes: TreeNodeLike[] = [
  { id: 'root', parentId: null, nodeType: 'folder', metadata: { name: 'Resources' } },
  { id: 'alpha', parentId: 'root', nodeType: 'folder', metadata: { name: 'Alpha' } },
  { id: 'alpha-shapes', parentId: 'alpha', nodeType: 'folder', metadata: { name: 'Shapes' } },
  {
    id: 'alpha-shape-1',
    parentId: 'alpha-shapes',
    nodeType: 'shape',
    metadata: { name: 'Shape A' },
  },
  { id: 'beta', parentId: 'root', nodeType: 'folder', metadata: { name: 'Beta' } },
  { id: 'beta-basemap', parentId: 'beta', nodeType: 'basemap', metadata: { name: 'Basemap B' } },
  { id: 'beta-route', parentId: 'beta', nodeType: 'route', metadata: { name: 'Route B' } },
  { id: 'beta-styler', parentId: 'beta', nodeType: 'styler', metadata: { name: 'Styler B' } },
];

describe('resourceTreeOrdering', () => {
  it('builds absolute paths from root to node', () => {
    const nodeById = createNodeMap(nodes);
    expect(buildAbsolutePath('alpha-shape-1', nodeById)).toBe('/Resources/Alpha/Shapes/Shape A');
  });

  it('extracts non-overlapping branch roots from selections', () => {
    const nodeById = createNodeMap(nodes);
    const selected = ['alpha', 'alpha-shape-1', 'beta'];
    const roots = getNonOverlappingBranchRoots(selected, nodeById);
    expect(roots).toEqual(['alpha', 'beta']);
  });

  it('orders resource nodes by absolute path per type', () => {
    const nodeById = createNodeMap(nodes);
    const roots = getNonOverlappingBranchRoots(['alpha', 'beta'], nodeById);
    const ordered = collectOrderedNodesByType({
      rootIds: roots,
      nodeById,
      allowedTypes: ['basemap', 'shape', 'location', 'route'],
    });

    expect(ordered.basemap?.map((node) => node.id)).toEqual(['beta-basemap']);
    expect(ordered.route?.map((node) => node.id)).toEqual(['beta-route']);
    expect(ordered.shape?.map((node) => node.id)).toEqual(['alpha-shape-1']);
  });

  it('combines styler style specs in absolute-path order', () => {
    const nodeById = createNodeMap(nodes);
    const styleA: MapLibreStyle = {
      version: 8,
      sources: {
        alpha: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [{ id: 'layer-alpha', type: 'fill', paint: { 'fill-color': '#ff0000' } }],
    } as MapLibreStyle;
    const styleB: MapLibreStyle = {
      version: 8,
      sources: {
        beta: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [{ id: 'layer-beta', type: 'fill', paint: { 'fill-color': '#0000ff' } }],
    } as MapLibreStyle;

    const inputs = [
      {
        nodeId: 'beta-styler',
        absolutePath: buildAbsolutePath('beta-styler', nodeById),
        styleSpec: styleB,
      },
      {
        nodeId: 'alpha-shape-1',
        absolutePath: buildAbsolutePath('alpha-shape-1', nodeById),
        styleSpec: styleA,
      },
    ];

    const combined = combineStylerStyleSpecs(inputs);
    expect(combined.layers?.map((layer) => layer.id)).toEqual(['layer-alpha', 'layer-beta']);
    expect(Object.keys(combined.sources ?? {})).toEqual(['alpha', 'beta']);
  });
});
