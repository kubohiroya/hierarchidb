import type { TreeNode } from '@hierarchidb/tree-api';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterNodesByCaptureLayers,
  normalizeMapImageCaptureLayerPath,
  useFolderLayers,
} from '../useFolderLayers.js';

const workerMocks = vi.hoisted(() => {
  const getNode = vi.fn();
  const listAncestors = vi.fn();
  const listDescendants = vi.fn();
  const getQueryAPI = vi.fn(async () => ({
    getNode,
    listAncestors,
    listDescendants,
  }));
  const ensureWorkerAPI = vi.fn(async () => ({
    getQueryAPI,
    getShapeQueryAPI: vi.fn(),
    getRouteQueryAPI: vi.fn(),
  }));
  return {
    ensureWorkerAPI,
    getNode,
    getQueryAPI,
    listAncestors,
    listDescendants,
  };
});

vi.mock('@hierarchidb/styler-store', () => ({
  MAPLIBRE_PROPERTY_METADATA: {},
}));

vi.mock('@hierarchidb/ui-plugin-shell/ui-map', () => ({
  buildRouteSourceLayerName: vi.fn(() => 'routes'),
  buildShapeSourceLayerName: vi.fn((adminLevel: number, kind: string) => `${kind}-${adminLevel}`),
  DEFAULT_LAYER_SETS: [
    { id: 'shape', priority: 1, entries: [] },
    { id: 'route', priority: 2, entries: [] },
    { id: 'location', priority: 3, entries: [] },
  ],
  LOCATION_POINTS_ENTRY_ID: 'location:points',
  LOCATION_SYMBOLS_ENTRY_ID: 'location:symbols',
  parseShapeSourceLayerName: vi.fn(() => null),
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  ensureWorkerAPI: workerMocks.ensureWorkerAPI,
}));

vi.mock('@hierarchidb/util', () => ({
  getBuildDatabasePrefix: vi.fn(() => 'build'),
  getDBName: vi.fn((prefix: string, type: string) => `${prefix}-${type}`),
}));

const createFolderNode = (id: string): TreeNode =>
  ({
    id,
    parentId: 'root',
    nodeType: 'folder',
    metadata: {
      name: id,
      description: '',
      tags: [],
    },
    depth: 1,
    visible: true,
    createdAt: 1,
    updatedAt: 1,
    version: 0,
  }) as unknown as TreeNode;

const createNode = (id: string, parentId: string, name: string, nodeType = 'folder'): TreeNode =>
  ({
    id,
    parentId,
    nodeType,
    metadata: {
      name,
      description: '',
      tags: [],
    },
    depth: 1,
    visible: true,
    createdAt: 1,
    updatedAt: 1,
    version: 0,
  }) as unknown as TreeNode;

describe('useFolderLayers', () => {
  beforeEach(() => {
    workerMocks.getNode.mockResolvedValue(createFolderNode('parent'));
    workerMocks.listAncestors.mockResolvedValue([]);
    workerMocks.listDescendants.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('reloads folder layers when refreshKey changes for the same nodeId', async () => {
    const onPersistedZxy = vi.fn();
    const { rerender } = renderHook(
      ({ refreshKey }) =>
        useFolderLayers({
          nodeId: 'parent',
          refreshKey,
          onPersistedZxy,
        }),
      {
        initialProps: {
          refreshKey: 'job-1',
        },
      }
    );

    await waitFor(() => expect(workerMocks.listDescendants).toHaveBeenCalledTimes(1));

    rerender({ refreshKey: 'job-2' });

    await waitFor(() => expect(workerMocks.listDescendants).toHaveBeenCalledTimes(2));
    expect(workerMocks.getNode).toHaveBeenNthCalledWith(2, 'parent');
  });
});

describe('normalizeMapImageCaptureLayerPath', () => {
  it('normalizes explicit and implicit staging-root-relative paths', () => {
    expect(normalizeMapImageCaptureLayerPath('.')).toBe('.');
    expect(normalizeMapImageCaptureLayerPath('./My Folder')).toBe('My Folder');
    expect(normalizeMapImageCaptureLayerPath('My Folder')).toBe('My Folder');
  });

  it('rejects absolute, empty, current-directory, and parent-directory segments', () => {
    expect(() => normalizeMapImageCaptureLayerPath('/My Folder')).toThrow(/Invalid/);
    expect(() => normalizeMapImageCaptureLayerPath('./')).toThrow(/Invalid/);
    expect(() => normalizeMapImageCaptureLayerPath('A//B')).toThrow(/Invalid/);
    expect(() => normalizeMapImageCaptureLayerPath('A/./B')).toThrow(/Invalid/);
    expect(() => normalizeMapImageCaptureLayerPath('A/../B')).toThrow(/Invalid/);
  });
});

describe('filterNodesByCaptureLayers', () => {
  it('selects only requested visible layer subtrees by root-relative display-name path', () => {
    const root = createNode('root-node', '', 'Root');
    const group = createNode('group', 'root-node', 'Group');
    const selectedShape = createNode('shape-a', 'group', 'Shape A', 'shape');
    const otherShape = createNode('shape-b', 'root-node', 'Shape B', 'shape');

    const filtered = filterNodesByCaptureLayers({
      rootNode: root,
      descendants: [group, selectedShape, otherShape],
      nodesForLayers: [selectedShape, otherShape],
      captureLayers: [{ path: 'Group', visible: true }],
    });

    expect(filtered.map((node) => String(node.id))).toEqual(['shape-a']);
  });

  it('applies visible false as an exclusion after an inclusion', () => {
    const root = createNode('root-node', '', 'Root');
    const selectedShape = createNode('shape-a', 'root-node', 'Shape A', 'shape');
    const excludedRoute = createNode('route-a', 'root-node', 'Route A', 'route');

    const filtered = filterNodesByCaptureLayers({
      rootNode: root,
      descendants: [selectedShape, excludedRoute],
      nodesForLayers: [selectedShape, excludedRoute],
      captureLayers: [
        { path: '.', visible: true },
        { path: 'Route A', visible: false },
      ],
    });

    expect(filtered.map((node) => String(node.id))).toEqual(['shape-a']);
  });

  it('allows capture intent to include nodes that are normally invisible', () => {
    const root = createNode('root-node', '', 'Root');
    const hiddenShape = {
      ...createNode('shape-a', 'root-node', 'Shape A', 'shape'),
      visible: false,
    };

    const filtered = filterNodesByCaptureLayers({
      rootNode: root,
      descendants: [hiddenShape],
      nodesForLayers: [hiddenShape],
      captureLayers: [{ path: 'Shape A', visible: true }],
    });

    expect(filtered.map((node) => String(node.id))).toEqual(['shape-a']);
  });

  it('fails when a requested layer path does not resolve', () => {
    const root = createNode('root-node', '', 'Root');
    const shape = createNode('shape-a', 'root-node', 'Shape A', 'shape');

    expect(() =>
      filterNodesByCaptureLayers({
        rootNode: root,
        descendants: [shape],
        nodesForLayers: [shape],
        captureLayers: [{ path: 'Missing', visible: true }],
      })
    ).toThrow(/layer path was not found/);
  });
});
