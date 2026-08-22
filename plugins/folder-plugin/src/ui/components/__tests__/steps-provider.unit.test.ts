import { type NodeId, toNodeId } from '@hierarchidb/core-types';
import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import { describe, expect, it, vi } from 'vitest';
import {
  canStartFolderExport,
  createFolderExportFilename,
  type FolderExportDraftData,
  resolveFolderExportNodes,
} from '../steps-provider';

type TestNode = {
  id: NodeId;
  nodeType: 'folder' | 'shape' | 'location' | 'route';
  metadata?: Record<string, unknown>;
};

type TestQueryAPI = {
  getNode: (nodeId: NodeId) => Promise<TestNode | undefined>;
  listDescendants: (nodeId: NodeId) => Promise<TestNode[]>;
};

describe('folder-export steps provider', () => {
  it('registers five steps for folder-export', () => {
    const registry = PluginStepRegistry.getInstance();
    const provider = registry.getConfigProvider('folder-export');
    if (!provider) {
      throw new Error('folder-export provider is not registered');
    }

    const steps = provider.getCreateStepConfigs();
    expect(steps).toHaveLength(5);
    expect(steps.map((step) => step.id)).toEqual([
      'purpose',
      'target',
      'format',
      'options',
      'review',
    ]);
  });

  it('build eligibility matches export mode and options', () => {
    const continuityDraft: FolderExportDraftData = {
      exportMode: 'continuity',
      targetScope: 'all',
      format: 'json',
      minZoom: 0,
      maxZoom: 10,
      maxTileBytes: 1_000_000,
      downloadPayload: false,
    };
    const distributionDraft: FolderExportDraftData = {
      ...continuityDraft,
      exportMode: 'distribution',
      format: 'pbf.zip',
    };
    const invalidDistributionDraft: FolderExportDraftData = {
      ...distributionDraft,
      maxTileBytes: 0,
    };

    expect(canStartFolderExport(continuityDraft)).toBe(true);
    expect(canStartFolderExport(distributionDraft)).toBe(true);
    expect(canStartFolderExport(invalidDistributionDraft)).toBe(false);
  });

  it('creates filename with sanitized base name and format extension', () => {
    const timestamp = new Date('2026-02-01T01:02:03.456Z');
    const json = createFolderExportFilename('My:Folder/Name', 'json', timestamp);
    const zip = createFolderExportFilename('My*Folder?Name', 'pbf.zip', timestamp);
    const mvf = createFolderExportFilename('MyFolder', 'mvf', timestamp);

    expect(json).toBe('My_Folder_Name-2026-02-01T01-02-03.json');
    expect(zip).toBe('My_Folder_Name-2026-02-01T01-02-03.pbf.zip');
    expect(mvf).toBe('MyFolder-2026-02-01T01-02-03.mvf');
  });
});

describe('resolveFolderExportNodes', () => {
  it('collects descendants only for shapeOnly scope', async () => {
    const queryAPI = {
      getNode: vi.fn(
        async (nodeId: NodeId): Promise<TestNode | undefined> => ({
          id: toNodeId(nodeId),
          nodeType: 'folder',
          metadata: {},
        })
      ),
      listDescendants: vi.fn(async () => [
        { id: toNodeId('shape-1'), nodeType: 'shape', metadata: {} },
        { id: toNodeId('route-1'), nodeType: 'route', metadata: {} },
        { id: toNodeId('shape-2'), nodeType: 'shape', metadata: {} },
      ]),
    };

    const nodes = await resolveFolderExportNodes(queryAPI, toNodeId('folder-root'), 'shapeOnly');

    expect(queryAPI.getNode).toHaveBeenCalledWith(toNodeId('folder-root'));
    expect(queryAPI.listDescendants).toHaveBeenCalledWith(toNodeId('folder-root'));
    expect(nodes).toEqual([
      { id: toNodeId('shape-1'), nodeType: 'shape', metadata: {} },
      { id: toNodeId('shape-2'), nodeType: 'shape', metadata: {} },
    ]);
  });

  it('includes root and descendants for all scope', async () => {
    const rootNode: TestNode = {
      id: toNodeId('folder-root'),
      nodeType: 'folder',
      metadata: { name: 'root' },
    };
    const queryAPI = {
      getNode: vi.fn(async (nodeId: NodeId): Promise<TestNode | undefined> => {
        if (nodeId === toNodeId('folder-root')) return rootNode;
        return undefined;
      }),
      listDescendants: vi.fn(async () => [
        { id: toNodeId('shape-1'), nodeType: 'shape', metadata: {} },
        { id: toNodeId('location-1'), nodeType: 'location', metadata: {} },
      ]),
    } satisfies TestQueryAPI;

    const nodes = await resolveFolderExportNodes(queryAPI, toNodeId('folder-root'), 'all');

    expect(queryAPI.listDescendants).toHaveBeenCalledWith(toNodeId('folder-root'));
    expect(nodes).toEqual([
      rootNode,
      { id: toNodeId('shape-1'), nodeType: 'shape', metadata: {} },
      { id: toNodeId('location-1'), nodeType: 'location', metadata: {} },
    ]);
  });
});
