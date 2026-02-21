import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { ImportData } from '@hierarchidb/import-export-api';
import type { ImportExportDBPort, VectorTileRecord } from '../ports';

class InMemoryImportExportPort implements ImportExportDBPort {
  private nodes = new Map<NodeId, TreeNode>();
  createdNodes: TreeNode[] = [];

  constructor(rootId: NodeId, depth = 0) {
    this.nodes.set(rootId, {
      id: rootId,
      parentId: rootId,
      nodeType: 'folder' as NodeType,
      name: 'root',
      description: '',
      depth,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as TreeNode);
  }

  seedNode(node: TreeNode): void {
    this.nodes.set(node.id, { ...node });
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.hasChildren = true;
        parent.updatedAt = Date.now();
        parent.version = (parent.version || 0) + 1;
        this.nodes.set(parent.id, parent);
      }
    }
  }

  async bulkCreateNodes(nodes: TreeNode[]): Promise<void> {
    for (const node of nodes) {
      const copy = { ...node } as TreeNode;
      this.nodes.set(copy.id, copy);
      this.createdNodes.push(copy);
      if (copy.parentId) {
        const parent = this.nodes.get(copy.parentId);
        if (parent) {
          parent.hasChildren = true;
          parent.updatedAt = Date.now();
          parent.version = (parent.version || 0) + 1;
          this.nodes.set(parent.id, parent);
        }
      }
    }
  }

  async listChildren(parentId: NodeId): Promise<TreeNode[]> {
    return Array.from(this.nodes.values()).filter((node) => node.parentId === parentId);
  }

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    const node = this.nodes.get(nodeId);
    return node ? { ...node } : undefined;
  }

  async listVectorTileRecords(_nodeIds: NodeId[]): Promise<VectorTileRecord[]> {
    return [];
  }
}

async function loadPopulationTemplate() {
  const templateUrl = new URL('../../../../app/public/templates/population-2023/population-by-countries-2023.json', import.meta.url);
  const raw = await readFile(templateUrl, 'utf-8');
  const json = JSON.parse(raw) as {
    nodes: Record<string, Record<string, unknown>>;
    rootNodeIds: string[];
  };

  const nodesMap = json.nodes || {};
  const rootIds = json.rootNodeIds || [];

  const buildTree = (id: string, depth: number): ImportData['nodes'][number] | null => {
    const node = nodesMap[id];
    if (!node) return null;
    const children = Object.values(nodesMap)
      .filter((child) => child?.parentTreeNodeId === id)
      .map((child) => buildTree(child.treeNodeId as string, depth + 1))
      .filter((child): child is ImportData['nodes'][number] => Boolean(child));
    return {
      name: String(node.name ?? ''),
      nodeType: (node.treeNodeType ?? 'folder') as string,
      description: typeof node.description === 'string' ? node.description : undefined,
      metadata: nodesMap[id]?.metadata as Record<string, unknown> | undefined,
      children: children.length ? children : undefined,
    };
  };

  return rootIds
    .map((rid) => buildTree(rid, 1))
    .filter((node): node is ImportData['nodes'][number] => Boolean(node));
}

describe('Import Template - depth assignment', () => {
  it('assigns relative depth when importing Total Population template', async () => {
    const payloadNodes = await loadPopulationTemplate();
    const port = new InMemoryImportExportPort('root' as NodeId, 0);

    const { ImportExportService } = await import('../ImportExportService');
    const svc = await ImportExportService.getSingleton(port as unknown as ImportExportDBPort);

    const result = await svc.importNodes({
      treeId: 'r' as TreeId,
      targetParentId: 'root' as NodeId,
      data: { nodes: payloadNodes },
      format: 'json',
      validateFirst: false,
    });

    expect(result.success).toBe(true);
    const byName = new Map<string, TreeNode>();
    for (const node of port.createdNodes) {
      byName.set(node.name, node);
    }

    expect(byName.get('Total Population by Country')?.depth).toBe(1);
    expect(byName.get('Country Boundaries')?.depth).toBe(2);
    expect(byName.get('Population Color Map')?.depth).toBe(2);
    expect(byName.get('Population Data Table')?.depth).toBe(2);

    const rootNode = port['nodes'].get('root' as NodeId);
    expect(rootNode?.hasChildren).toBe(true);
    const folderNode = byName.get('Total Population by Country');
    expect(folderNode?.hasChildren).toBe(true);
  });
});

describe('Import Template - name conflicts', () => {
  it('auto-renames nodes when conflictResolution is rename', async () => {
    const port = new InMemoryImportExportPort('root' as NodeId, 0);
    port.seedNode({
      id: 'existing' as NodeId,
      parentId: 'root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'Report',
      description: '',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as TreeNode);

    const importData: ImportData = {
      nodes: [
        { name: 'Report', nodeType: 'folder' },
        { name: 'Report', nodeType: 'folder' },
      ],
    };

    const { ImportExportService } = await import('../ImportExportService');
    const svc = await ImportExportService.getSingleton(port as unknown as ImportExportDBPort);

    const result = await svc.importNodes({
      treeId: 'r' as TreeId,
      targetParentId: 'root' as NodeId,
      data: importData,
      format: 'json',
      conflictResolution: 'rename',
    });

    expect(result.success).toBe(true);
    const createdNames = port.createdNodes.map((node) => node.name);
    expect(createdNames).toContain('Report (2)');
    expect(createdNames).toContain('Report (3)');
    expect(new Set(createdNames).size).toBe(createdNames.length);
  });
});
