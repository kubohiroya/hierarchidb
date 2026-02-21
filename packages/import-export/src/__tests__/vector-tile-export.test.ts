import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { ImportExportDBPort, VectorTileRecord } from '../ports';

type JszipArchiveFile = {
  [name: string]: unknown;
};

type JszipArchive = {
  files: JszipArchiveFile;
};

type JszipCtor = {
  loadAsync(data: ArrayBuffer): Promise<JszipArchive>;
};

class InMemoryExportPort implements ImportExportDBPort {
  private nodes = new Map<NodeId, TreeNode>();

  constructor(nodes: TreeNode[]) {
    nodes.forEach((node) => {
      this.nodes.set(node.id, { ...node });
    });
  }

  async bulkCreateNodes(): Promise<void> {
    return;
  }

  async listChildren(parentId: NodeId): Promise<TreeNode[]> {
    return [...this.nodes.values()].filter((node) => node.parentId === parentId);
  }

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    const node = this.nodes.get(nodeId);
    return node ? { ...node } : undefined;
  }

  async listVectorTileRecords(nodeIds: NodeId[]): Promise<VectorTileRecord[]> {
    return this.vectorTiles.filter((tile) => nodeIds.includes(tile.nodeId));
  }

  private readonly vectorTiles = [
    {
      tileId: 'n1-0-0-0',
      nodeId: 'shape-node' as NodeId,
      z: 0,
      x: 0,
      y: 0,
      data_Uint8Array: new TextEncoder().encode('pbf-bytes-1'),
      size: 12,
      features: 2,
      generatedAt: 10,
    },
    {
      tileId: 'n1-1-2-3',
      nodeId: 'shape-node' as NodeId,
      z: 1,
      x: 2,
      y: 3,
      data_Uint8Array: new TextEncoder().encode('pbf-bytes-2'),
      size: 12,
      features: 5,
      generatedAt: 20,
    },
  ];
}

class MissingListVectorTileRecordsPort implements ImportExportDBPort {
  private nodes = new Map<NodeId, TreeNode>();
  constructor(nodes: TreeNode[]) {
    nodes.forEach((node) => {
      this.nodes.set(node.id, { ...node });
    });
  }

  async bulkCreateNodes(): Promise<void> {
    return;
  }

  async listChildren(parentId: NodeId): Promise<TreeNode[]> {
    return [...this.nodes.values()].filter((node) => node.parentId === parentId);
  }

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    const node = this.nodes.get(nodeId);
    return node ? { ...node } : undefined;
  }

  async listVectorTileRecords(_nodeIds: NodeId[]): Promise<VectorTileRecord[]> {
    throw new Error('Vector tile export is not supported in this runtime environment.');
  }
}

describe('ExportService vector tile export', () => {
  const createNodeSet = (): TreeNode[] => [
    {
      id: 'folder-node' as NodeId,
      parentId: 'folder-node' as NodeId,
      nodeType: 'folder',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      metadata: { name: 'Folder', description: 'Root folder for export' },
      visible: true,
    },
    {
      id: 'shape-node' as NodeId,
      parentId: 'folder-node' as NodeId,
      nodeType: 'shape',
      depth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      metadata: { name: 'Shape', description: 'Shape node' },
      visible: true,
    },
  ];

  let JSZipCtor: JszipCtor;
  beforeAll(async () => {
    const mod = await import('jszip');
    JSZipCtor = (mod.default ?? mod) as JszipCtor;
  });

  beforeEach(() => {
    SingletonMixin.terminate('ImportExportService');
  });

  afterEach(() => {
    SingletonMixin.terminate('ImportExportService');
  });

  it('exports pbf.zip with tile entries and metadata', async () => {
    const { ImportExportService } = await import('../ImportExportService');
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(createNodeSet()) as ImportExportDBPort
    );

    const result = await svc.exportNodes({
      nodeIds: ['folder-node' as NodeId],
      format: 'pbf.zip',
      includeChildren: true,
      includeMetadata: true,
      onProgress: () => {
        return;
      },
    });

    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('application/zip');
    expect(result.format).toBe('pbf.zip');
    expect(result.data).toBeInstanceOf(Blob);

    const blob = result.data as Blob;
    const zip = await JSZipCtor.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names).toContain('shape-node/0/0/0.pbf');
    expect(names).toContain('shape-node/1/2/3.pbf');
    expect(names).toContain('metadata.json');
    expect(names).toContain('summary.json');
  });

  it('exports mvf as binary zip archive with zip mime conversion', async () => {
    const { ImportExportService } = await import('../ImportExportService');
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(createNodeSet()) as ImportExportDBPort
    );

    const result = await svc.exportNodes({
      nodeIds: ['shape-node' as NodeId],
      format: 'mvf',
      includeChildren: false,
      includeMetadata: false,
    });

    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('application/octet-stream');
    expect(result.format).toBe('mvf');
    expect(result.data).toBeInstanceOf(Blob);
  });

  it('throws when runtime does not provide vector tile source', async () => {
    const { ImportExportService } = await import('../ImportExportService');
    const svc = await ImportExportService.getSingleton(
      new MissingListVectorTileRecordsPort(createNodeSet()) as ImportExportDBPort
    );

    await expect(
      svc.exportNodes({
        nodeIds: ['shape-node' as NodeId],
        format: 'pbf.zip',
        includeChildren: false,
      })
    ).rejects.toThrow('Vector tile export is not supported in this runtime environment.');
  });

  it('excludes metadata.json when includeMetadata is false', async () => {
    const { ImportExportService } = await import('../ImportExportService');
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(createNodeSet()) as ImportExportDBPort
    );

    const result = await svc.exportNodes({
      nodeIds: ['folder-node' as NodeId],
      format: 'pbf.zip',
      includeChildren: true,
      includeMetadata: false,
    });

    const blob = result.data as Blob;
    const zip = await JSZipCtor.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);

    expect(result.success).toBe(true);
    expect(names).not.toContain('metadata.json');
    expect(names).toContain('summary.json');
  });

  it('returns empty tiles when exporting non-shape nodes', async () => {
    const { ImportExportService } = await import('../ImportExportService');
    const nonShapeNodes = [
      {
        id: 'folder-node' as NodeId,
        parentId: 'folder-node' as NodeId,
        nodeType: 'folder',
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        metadata: { name: 'Folder Only', description: 'No shapes in export target' },
        visible: true,
      },
      {
        id: 'route-node' as NodeId,
        parentId: 'folder-node' as NodeId,
        nodeType: 'route',
        depth: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        metadata: { name: 'Route Only', description: 'No shape tiles here' },
        visible: true,
      },
    ];
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(nonShapeNodes) as ImportExportDBPort
    );

    const result = await svc.exportNodes({
      nodeIds: ['folder-node' as NodeId],
      format: 'pbf.zip',
      includeChildren: true,
      includeMetadata: true,
    });

    expect(result.success).toBe(true);
    expect(result.exportedCount).toBe(0);
    expect(result.data).toBeInstanceOf(Blob);

    const zip = await JSZipCtor.loadAsync(await (result.data as Blob).arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names).not.toContain('route-node/0/0/0.pbf');
    expect(names).toContain('summary.json');
  });

  it('throws on unsupported export format', async () => {
    const { ImportExportService } = await import('../ImportExportService');
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(createNodeSet()) as ImportExportDBPort
    );

    await expect(
      svc.exportNodes({
        nodeIds: ['folder-node' as NodeId],
        format: 'xml',
        includeChildren: true,
      })
    ).rejects.toThrow('Unsupported export format: xml');
  });
});
