// Plain ESM test - no tsx transpilation needed since all deps are pre-built dist bundles.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { SingletonMixin } from '@hierarchidb/util';
import { toNodeType } from '@hierarchidb/core-types';
import { ImportExportService } from '../../dist/index.js';

/** @typedef {import('@hierarchidb/core-types').NodeId} NodeId */
/** @typedef {import('@hierarchidb/tree-api').TreeNode} TreeNode */
/** @typedef {import('../../dist/index.js').ImportExportDBPort} ImportExportDBPort */
/** @typedef {import('../../dist/index.js').VectorTileRecord} VectorTileRecord */
/** @typedef {Record<string, Uint8Array>} ZipEntries */

class InMemoryExportPort {
  /** @type {Map<NodeId, TreeNode>} */
  #nodes = new Map();

  /** @param {TreeNode[]} nodes */
  constructor(nodes) {
    nodes.forEach((node) => {
      this.#nodes.set(node.id, { ...node });
    });
  }

  async bulkCreateNodes() {}

  /** @param {NodeId} parentId @returns {Promise<TreeNode[]>} */
  async listChildren(parentId) {
    // Only return nodes whose parentId matches AND whose id differs from parentId
    // to avoid infinite recursion on root nodes that self-reference.
    return [...this.#nodes.values()].filter(
      (node) => node.parentId === parentId && node.id !== parentId
    );
  }

  /** @param {NodeId} nodeId @returns {Promise<TreeNode | undefined>} */
  async getNode(nodeId) {
    const node = this.#nodes.get(nodeId);
    return node ? { ...node } : undefined;
  }

  /** @param {NodeId[]} nodeIds @returns {Promise<VectorTileRecord[]>} */
  async listVectorTileRecords(nodeIds) {
    return this.#vectorTiles.filter((tile) => nodeIds.includes(tile.nodeId));
  }

  #vectorTiles = [
    {
      tileId: 'n1-0-0-0',
      nodeId: /** @type {NodeId} */ ('shape-node'),
      z: 0, x: 0, y: 0,
      data_Uint8Array: new TextEncoder().encode('pbf-bytes-1'),
      size: 12, features: 2, generatedAt: 10,
    },
    {
      tileId: 'n1-1-2-3',
      nodeId: /** @type {NodeId} */ ('shape-node'),
      z: 1, x: 2, y: 3,
      data_Uint8Array: new TextEncoder().encode('pbf-bytes-2'),
      size: 12, features: 5, generatedAt: 20,
    },
  ];
}

class MissingListVectorTileRecordsPort {
  /** @type {Map<NodeId, TreeNode>} */
  #nodes = new Map();

  /** @param {TreeNode[]} nodes */
  constructor(nodes) {
    nodes.forEach((node) => {
      this.#nodes.set(node.id, { ...node });
    });
  }

  async bulkCreateNodes() {}

  /** @param {NodeId} parentId @returns {Promise<TreeNode[]>} */
  async listChildren(parentId) {
    return [...this.#nodes.values()].filter(
      (node) => node.parentId === parentId && node.id !== parentId
    );
  }

  /** @param {NodeId} nodeId @returns {Promise<TreeNode | undefined>} */
  async getNode(nodeId) {
    const node = this.#nodes.get(nodeId);
    return node ? { ...node } : undefined;
  }

  async listVectorTileRecords(_nodeIds) {
    throw new Error('Vector tile export is not supported in this runtime environment.');
  }
}

/** @returns {TreeNode[]} */
const createNodeSet = () => [
  {
    id: /** @type {NodeId} */ ('folder-node'),
    parentId: /** @type {NodeId} */ ('folder-node'),
    nodeType: toNodeType('folder'),
    depth: 1, createdAt: Date.now(), updatedAt: Date.now(), version: 1,
    metadata: { name: 'Folder', description: 'Root folder for export', tags: [] },
    draftMetadata: null, data: null, visible: true,
  },
  {
    id: /** @type {NodeId} */ ('shape-node'),
    parentId: /** @type {NodeId} */ ('folder-node'),
    nodeType: toNodeType('shape'),
    depth: 2, createdAt: Date.now(), updatedAt: Date.now(), version: 1,
    metadata: { name: 'Shape', description: 'Shape node', tags: [] },
    draftMetadata: null, data: null, visible: true,
  },
];

/** @param {Blob} blob @returns {Promise<ZipEntries>} */
const loadZip = async (blob) => {
  const buf = await blob.arrayBuffer();
  return unzipSync(new Uint8Array(buf));
};

describe('ExportService vector tile export', () => {
  beforeEach(() => {
    SingletonMixin.terminate('ImportExportService');
  });

  afterEach(() => {
    SingletonMixin.terminate('ImportExportService');
  });

  it('exports pbf.zip with tile entries and metadata', async () => {
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(createNodeSet())
    );

    const result = await svc.exportNodes({
      nodeIds: [/** @type {NodeId} */ ('folder-node')],
      format: 'pbf.zip',
      includeChildren: true,
      includeMetadata: true,
      onProgress: () => {},
    });

    assert.equal(result.success, true);
    assert.equal(result.mimeType, 'application/zip');
    assert.equal(result.format, 'pbf.zip');
    assert.ok(result.data instanceof Blob);

    const zip = await loadZip(result.data);
    const names = Object.keys(zip);
    assert.ok(names.includes('shape-node/0/0/0.pbf'));
    assert.ok(names.includes('shape-node/1/2/3.pbf'));
    assert.ok(names.includes('metadata.json'));
    assert.ok(names.includes('summary.json'));
  });

  it('exports mvf as binary zip archive with zip mime conversion', async () => {
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(createNodeSet())
    );

    const result = await svc.exportNodes({
      nodeIds: [/** @type {NodeId} */ ('shape-node')],
      format: 'mvf',
      includeChildren: false,
      includeMetadata: false,
    });

    assert.equal(result.success, true);
    assert.equal(result.mimeType, 'application/octet-stream');
    assert.equal(result.format, 'mvf');
    assert.ok(result.data instanceof Blob);
  });

  it('throws when runtime does not provide vector tile source', async () => {
    const svc = await ImportExportService.getSingleton(
      new MissingListVectorTileRecordsPort(createNodeSet())
    );

    await assert.rejects(
      () => svc.exportNodes({
        nodeIds: [/** @type {NodeId} */ ('shape-node')],
        format: 'pbf.zip',
        includeChildren: false,
      }),
      /Vector tile export is not supported in this runtime environment\./
    );
  });

  it('excludes metadata.json when includeMetadata is false', async () => {
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(createNodeSet())
    );

    const result = await svc.exportNodes({
      nodeIds: [/** @type {NodeId} */ ('folder-node')],
      format: 'pbf.zip',
      includeChildren: true,
      includeMetadata: false,
    });

    const zip = await loadZip(result.data);
    const names = Object.keys(zip);

    assert.equal(result.success, true);
    assert.ok(!names.includes('metadata.json'));
    assert.ok(names.includes('summary.json'));
  });

  it('returns empty tiles when exporting non-shape nodes', async () => {
    const nonShapeNodes = [
      {
        id: /** @type {NodeId} */ ('folder-node'),
        parentId: /** @type {NodeId} */ ('folder-node'),
        nodeType: toNodeType('folder'),
        depth: 1, createdAt: Date.now(), updatedAt: Date.now(), version: 1,
        metadata: { name: 'Folder Only', description: 'No shapes in export target', tags: [] },
        draftMetadata: null, data: null, visible: true,
      },
      {
        id: /** @type {NodeId} */ ('route-node'),
        parentId: /** @type {NodeId} */ ('folder-node'),
        nodeType: toNodeType('route'),
        depth: 2, createdAt: Date.now(), updatedAt: Date.now(), version: 1,
        metadata: { name: 'Route Only', description: 'No shape tiles here', tags: [] },
        draftMetadata: null, data: null, visible: true,
      },
    ];
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(nonShapeNodes)
    );

    const result = await svc.exportNodes({
      nodeIds: [/** @type {NodeId} */ ('folder-node')],
      format: 'pbf.zip',
      includeChildren: true,
      includeMetadata: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.exportedCount, 0);
    assert.ok(result.data instanceof Blob);

    const zip = await loadZip(result.data);
    const names = Object.keys(zip);
    assert.ok(!names.includes('route-node/0/0/0.pbf'));
    assert.ok(names.includes('summary.json'));
  });

  it('throws on unsupported export format', async () => {
    const svc = await ImportExportService.getSingleton(
      new InMemoryExportPort(createNodeSet())
    );

    await assert.rejects(
      () => svc.exportNodes({
        nodeIds: [/** @type {NodeId} */ ('folder-node')],
        format: 'xml',
        includeChildren: true,
      }),
      /Unsupported export format: xml/
    );
  });
});
