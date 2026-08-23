import type { TreeNode } from '@hierarchidb/tree-api';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFolderLayers } from '../useFolderLayers.js';

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
