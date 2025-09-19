import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { ImportExportDBPort } from '../ports.js';

class InMemoryImportExportPort implements ImportExportDBPort {
  private nodes = new Map<NodeId, TreeNode>();
  createdNodes: TreeNode[] = [];

  constructor(rootId: NodeId, depth = 0) {
    this.nodes.set(rootId, {
      id: rootId,
      parentId: null,
      nodeType: 'folder' as any,
      name: 'root',
      description: '',
      depth,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    } as TreeNode);
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
}

async function loadPopulationTemplate() {
  const templateUrl = new URL('../../../../app/public/templates/population-2023/tree-nodes.json', import.meta.url);
  const raw = await readFile(templateUrl, 'utf-8');
  const json = JSON.parse(raw) as {
    nodes: Record<string, any>;
    rootNodeIds: string[];
  };

  const nodesMap = json.nodes || {};
  const rootIds = json.rootNodeIds || [];

  const buildTree = (id: string, depth: number): any => {
    const node = nodesMap[id];
    if (!node) return null;
    const children = Object.values(nodesMap)
      .filter((child: any) => child?.parentTreeNodeId === id)
      .map((child: any) => buildTree(child.treeNodeId, depth + 1))
      .filter(Boolean);
    return {
      name: node.name,
      nodeType: node.treeNodeType || 'folder',
      description: node.description,
      metadata: node.metadata,
      depth,
      children: children.length ? children : undefined,
    };
  };

  return rootIds
    .map((rid) => buildTree(rid, 1))
    .filter(Boolean);
}

describe('Import Template - depth assignment', () => {
  it('assigns relative depth when importing Total Population template', async () => {
    const payloadNodes = await loadPopulationTemplate();
    const port = new InMemoryImportExportPort('root' as NodeId, 0);

    const { ImportExportService } = await import('../ImportExportService.js');
    const svc = await ImportExportService.getSingleton(port as unknown as ImportExportDBPort);

    const result = await svc.importNodes({
      treeId: 'r' as any,
      targetParentId: 'root' as NodeId,
      data: { nodes: payloadNodes as any[] },
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
