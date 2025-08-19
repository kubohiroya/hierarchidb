import {
  type Tree,
  type TreeNode,
  type TreeNodeId,
  TreeRootNodeTypes,
  type TreeRootState,
  type TreeChangeEvent,
} from '@hierarchidb/core';
import Dexie, { type Table } from 'dexie';
import { Subject } from 'rxjs';

export type TreeRow = Tree;
export type TreeNodeRow = TreeNode;
export type TreeRootStateRow = TreeRootState;

export class CoreDB extends Dexie {
  trees!: Table<TreeRow, string>;
  nodes!: Table<TreeNodeRow, string>;
  rootStates!: Table<TreeRootStateRow, [string, string]>;

  // イベント通知用のSubject
  public readonly changeSubject = new Subject<TreeChangeEvent>();

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
        ['r', 'p'].flatMap((treeId) => [
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
      );
    }
    if ((await this.rootStates.count()) === 0) {
      this.rootStates.bulkPut(
        ['r', 'p'].flatMap((treeId) =>
          [TreeRootNodeTypes.Root, TreeRootNodeTypes.Trash].map((treeRootNodeType) => ({
            treeId,
            treeRootNodeId: treeId + treeRootNodeType,
            expanded: {},
          }))
        )
      );
    }
  }

  async getTree(treeId: string): Promise<Tree | undefined> {
    return await this.trees.get(treeId);
  }

  getTrees(): Promise<Tree[]> {
    return this.trees.toArray();
  }

  // CRUD operations for TreeNode
  async getNode(nodeId: TreeNodeId): Promise<TreeNode | undefined> {
    return await this.nodes.get(nodeId);
  }

  async createNode(node: TreeNode): Promise<TreeNodeId> {
    await this.nodes.add(node);
    
    // 作成イベントを通知
    this.changeSubject.next({
      type: 'node-created' as const,
      nodeId: node.treeNodeId,
      node: node,
      timestamp: Date.now(),
    });
    
    return node.treeNodeId;
  }

  async updateNode(node: TreeNode): Promise<void> {
    // 更新前の状態を取得
    const oldNode = await this.nodes.get(node.treeNodeId);
    
    await this.nodes.put(node);
    
    // 更新イベントを通知
    if (oldNode) {
      const changes: {
        name: { old: string; new: string } | undefined;
        parentTreeNodeId: { old: TreeNodeId; new: TreeNodeId } | undefined;
      } = {
        name: undefined,
        parentTreeNodeId: undefined,
      };
      if (oldNode.name !== node.name) {
        changes.name = { old: oldNode.name, new: node.name };
      }
      if (oldNode.parentTreeNodeId !== node.parentTreeNodeId) {
        changes.parentTreeNodeId = { old: oldNode.parentTreeNodeId, new: node.parentTreeNodeId };
      }
      
      const changeEvent: TreeChangeEvent = {
        type: 'node-updated' as const,
        nodeId: node.treeNodeId,
        node: node, // Include the updated node
        previousNode: oldNode, // Include the previous node
        timestamp: Date.now(),
      };
      
      this.changeSubject.next(changeEvent);
    }
  }

  async deleteNode(nodeId: TreeNodeId): Promise<void> {
    await this.nodes.delete(nodeId);
    
    // 削除イベントを通知
    this.changeSubject.next({
      type: 'node-deleted' as const,
      nodeId: nodeId,
      timestamp: Date.now(),
    });
  }

  async getChildren(parentId: TreeNodeId): Promise<TreeNode[]> {
    return await this.nodes.where('parentTreeNodeId').equals(parentId).toArray();
  }

  /**
   * データベース接続を閉じる際にSubjectもクリーンアップ
   */
  close(): void {
    this.changeSubject.complete();
    super.close();
  }

  /**
   * バルク操作用のメソッド
   */
  async bulkCreateNodes(nodes: TreeNode[]): Promise<void> {
    await this.nodes.bulkAdd(nodes);
    
    // バルク作成イベントを個別に通知
    nodes.forEach(node => {
      this.changeSubject.next({
        type: 'node-created' as const,
        nodeId: node.treeNodeId,
        node: node,
        timestamp: Date.now(),
      });
    });
  }

  async bulkUpdateNodes(nodes: TreeNode[]): Promise<void> {
    // 更新前の状態を取得
    const oldNodes = await Promise.all(
      nodes.map(node => this.nodes.get(node.treeNodeId))
    );
    
    await this.nodes.bulkPut(nodes);
    
    // バルク更新イベントを個別に通知
    nodes.forEach((node, index) => {
      const oldNode = oldNodes[index];
      if (oldNode) {
        const changes: {
          name: { old: string; new: string } | undefined;
          parentTreeNodeId: { old: TreeNodeId; new: TreeNodeId } | undefined;
        } = {
          name: undefined,
          parentTreeNodeId: undefined,
        };
        if (oldNode.name !== node.name) {
          changes.name = { old: oldNode.name, new: node.name };
        }
        if (oldNode.parentTreeNodeId !== node.parentTreeNodeId) {
          changes.parentTreeNodeId = { old: oldNode.parentTreeNodeId, new: node.parentTreeNodeId };
        }
        
        this.changeSubject.next({
          type: 'node-updated' as const,
          nodeId: node.treeNodeId,
          node: node,
          previousNode: oldNode,
          timestamp: Date.now(),
        });
      }
    });
  }

  async bulkDeleteNodes(nodeIds: TreeNodeId[]): Promise<void> {
    await this.nodes.bulkDelete(nodeIds);
    
    // バルク削除イベントを個別に通知
    nodeIds.forEach(nodeId => {
      this.changeSubject.next({
        type: 'node-deleted' as const,
        nodeId: nodeId,
        timestamp: Date.now(),
      });
    });
  }
}
