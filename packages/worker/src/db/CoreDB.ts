import Dexie, { Table } from 'dexie';
import {
  Tree,
  TreeNode,
  TreeRootNodeId,
  TreeNodeId,
  TreeRootNodeTypes,
  TreeRootState,
} from '@hierarchidb/core';

export type TreeRow = Tree;
export type TreeNodeRow = TreeNode;
export type TreeRootStateRow = TreeRootState;

export class CoreDB extends Dexie {
  trees!: Table<TreeRow, string>;
  nodes!: Table<TreeNodeRow, string>;
  rootStates!: Table<TreeRootStateRow, [string, string]>;

  constructor(name: string = 'hierarchidb') {
    super(`${name}-CoreDB`);

    this.version(1).stores({
      trees: '&treeId, treeRootNodeId, treeTrashRootNodeId, superRootNodeId',
      nodes: [
        '&treeNodeId',
        'parentTreeNodeId',
        '&[parentTreeNodeId+name]',
        '[parentTreeNodeId+updatedAt]',
        'removedAt',
        'originalParentTreeNodeId',
        '*references',
      ].join(', '),
      rootStates: '&[treeId+treeRootNodeType], treeId, treeRootNodeId',
    });
  }

  private treeIdToTreeName(treeId: string): string {
    return treeId === 'r' ? 'Resources' : 'Projects';
  }

  async initialize(): Promise<void> {
    console.log('initialize');
    const now = Date.now();
    if ((await this.trees.count()) === 0) {
      this.trees.bulkPut(
        ['r', 'p'].map((treeId) => ({
          treeId,
          name: this.treeIdToTreeName(treeId),
          superRootNodeId: treeId + TreeRootNodeTypes.SuperRoot,
          treeRootNodeId: treeId + TreeRootNodeTypes.Root,
          treeTrashRootNodeId: treeId + TreeRootNodeTypes.Trash,
        }))
      );
    }
    if ((await this.nodes.count()) === 0) {
      this.nodes.bulkPut(
        ['r', 'p']
          .map((treeId) => [
            {
              parentTreeNodeId: TreeRootNodeTypes.SuperRoot,
              treeNodeId: treeId + TreeRootNodeTypes.Root,
              treeNodeType: TreeRootNodeTypes.Root,
              name: this.treeIdToTreeName(treeId),
              createdAt: now,
              updatedAt: now,
              version: 1,
            },
            {
              parentTreeNodeId: TreeRootNodeTypes.SuperRoot,
              treeNodeId: treeId + TreeRootNodeTypes.Trash,
              treeNodeType: TreeRootNodeTypes.Trash,
              name: 'Trash',
              createdAt: now,
              updatedAt: now,
              version: 1,
            },
          ])
          .flat()
      );
    }
    if ((await this.rootStates.count()) === 0) {
      this.rootStates.bulkPut(
        ['r', 'p']
          .map((treeId) =>
            [TreeRootNodeTypes.Root, TreeRootNodeTypes.Trash].map((treeRootNodeType) => ({
              treeId,
              treeRootNodeId: treeId + treeRootNodeType,
              expanded: {},
            }))
          )
          .flat()
      );
    }
  }

  async getTree(treeId: string): Promise<Tree | undefined> {
    return await this.trees.get(treeId);
  }

  async getTrees(): Promise<Tree[]> {
    return this.trees.toArray();
  }

  // CRUD operations for TreeNode
  async getNode(nodeId: TreeNodeId): Promise<TreeNode | undefined> {
    return await this.nodes.get(nodeId);
  }

  async createNode(node: TreeNode): Promise<TreeNodeId> {
    await this.nodes.add(node);
    return node.treeNodeId;
  }

  async updateNode(node: TreeNode): Promise<void> {
    await this.nodes.put(node);
  }

  async deleteNode(nodeId: TreeNodeId): Promise<void> {
    await this.nodes.delete(nodeId);
  }

  async getChildren(parentId: TreeNodeId): Promise<TreeNode[]> {
    return await this.nodes.where('parentTreeNodeId').equals(parentId).toArray();
  }
}
