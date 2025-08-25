import {
  type Tree,
  type TreeNode,
  type NodeId,
  type TreeId,
  type TreeRootState,
  type TreeChangeEvent,
  NodeIdGenerator,
  TREE_ROOT_NODE_TYPES,
} from '@hierarchidb/common-core';
import Dexie, { type Table } from 'dexie';
import { Subject } from 'rxjs';

export class CoreDB extends Dexie {
  trees!: Table<Tree, TreeId>;
  nodes!: Table<TreeNode, NodeId>;
  rootStates!: Table<TreeRootState, NodeId>;

  // イベント通知用のSubject
  public readonly changeSubject = new Subject<TreeChangeEvent>();

  constructor(name: string = 'hierarchidb') {
    super(`${name}-CoreDB`);

    this.version(1).stores({
      trees: '&id, treeRootId, trashRootId, superRootId',
      nodes: [
        '&id',
        'parentId',
        '&[parentId+name]',
        '[parentId+updatedAt]',
        'removedAt',
        'originalParentId',
        '*references',
      ].join(', '),
      rootStates: '&rootNodeId, treeId',
    });
  }

  private treeIdToTreeName(treeId: string): string {
    return treeId === 'r' ? 'Resources' : 'Projects';
  }

  async initialize(): Promise<void> {
    const now = Date.now();
    if ((await this.trees.count()) === 0) {
      await this.trees.bulkPut(
        ['r', 'p'].map((treeId) => ({
          treeId,
          name: this.treeIdToTreeName(treeId),
          id: treeId as TreeId,
          superRootId: NodeIdGenerator.superRootNode(treeId),
          rootId: NodeIdGenerator.rootNode(treeId),
          trashRootId: NodeIdGenerator.trashNode(treeId),
        }))
      );
    }
    if ((await this.nodes.count()) === 0) {
      const data = ['r', 'p'].flatMap((treeId) => [
        {
          parentId: NodeIdGenerator.superRootNode(treeId),
          id: NodeIdGenerator.rootNode(treeId),
          nodeType: TREE_ROOT_NODE_TYPES.ROOT,
          name: this.treeIdToTreeName(treeId),
          createdAt: now,
          updatedAt: now,
          version: 1,
        },
        {
          parentId: NodeIdGenerator.superRootNode(treeId),
          id: NodeIdGenerator.trashNode(treeId),
          nodeType: TREE_ROOT_NODE_TYPES.TRASH,
          name: 'Trash',
          createdAt: now,
          updatedAt: now,
          version: 1,
        },
      ]) satisfies TreeNode[];
      console.log('⭐️initialize nodes', data);
      await this.nodes.bulkAdd(data);
    }
    if ((await this.rootStates.count()) === 0) {
      const rootStateData = ['r', 'p'].flatMap((treeId) =>
        [TREE_ROOT_NODE_TYPES.ROOT, TREE_ROOT_NODE_TYPES.TRASH].map((treeRootNodeType) => ({
          treeId: treeId as TreeId,
          rootNodeId:
            treeRootNodeType === TREE_ROOT_NODE_TYPES.ROOT
              ? NodeIdGenerator.rootNode(treeId)
              : NodeIdGenerator.trashNode(treeId),
          expanded: {},
        }))
      );
      
      console.log('⭐️initialize rootStates', rootStateData);
      
      try {
        await this.rootStates.bulkAdd(rootStateData);
      } catch (error) {
        console.error('Failed to initialize rootStates:', error);
        console.error('Data that failed:', rootStateData);
        throw error;
      }
    }
  }

  async getTree(treeId: TreeId): Promise<Tree | undefined> {
    return await this.trees.get(treeId);
  }

  listTrees(): Promise<Tree[]> {
    return this.trees.toArray();
  }

  // CRUD operations for TreeNode
  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    // Validate nodeId to prevent Dexie errors
    if (!nodeId || typeof nodeId !== 'string' || nodeId.length === 0) {
      console.warn('Invalid nodeId provided to CoreDB.getNode:', nodeId);
      return undefined;
    }

    return await this.nodes.get(nodeId);
  }

  async createNode(node: TreeNode): Promise<NodeId> {
    await this.nodes.add(node);

    // 作成イベントを通知
    this.changeSubject.next({
      type: 'node-created' as const,
      nodeId: node.id,
      node: node,
      timestamp: Date.now(),
    });

    return node.id;
  }

  async updateNode(node: TreeNode): Promise<void> {
    // 更新前の状態を取得
    const oldNode = await this.nodes.get(node.id);

    await this.nodes.put(node);

    // 更新イベントを通知
    if (oldNode) {
      const changes: {
        name: { old: string; new: string } | undefined;
        parentId: { old: NodeId; new: NodeId } | undefined;
      } = {
        name: undefined,
        parentId: undefined,
      };
      if (oldNode.name !== node.name) {
        changes.name = { old: oldNode.name, new: node.name };
      }
      if (oldNode.parentId !== node.parentId) {
        changes.parentId = { old: oldNode.parentId, new: node.parentId };
      }

      const changeEvent: TreeChangeEvent = {
        type: 'node-updated' as const,
        nodeId: node.id,
        node: node, // Include the updated node
        previousNode: oldNode, // Include the previous node
        timestamp: Date.now(),
      };

      this.changeSubject.next(changeEvent);
    }
  }

  async deleteNode(nodeId: NodeId): Promise<void> {
    await this.nodes.delete(nodeId);

    // 削除イベントを通知
    this.changeSubject.next({
      type: 'node-deleted' as const,
      nodeId: nodeId,
      timestamp: Date.now(),
    });
  }

  async listChildren(parentId: NodeId): Promise<TreeNode[]> {
    const children = await this.nodes
      .where('parentId')
      .equals(parentId)
      .filter((node) => !node.removedAt)
      .sortBy('createdAt');

    return children;
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
    nodes.forEach((node) => {
      this.changeSubject.next({
        type: 'node-created' as const,
        nodeId: node.id,
        node: node,
        timestamp: Date.now(),
      });
    });
  }

  async bulkUpdateNodes(nodes: TreeNode[]): Promise<void> {
    // 更新前の状態を取得
    const oldNodes = await Promise.all(nodes.map((node) => this.nodes.get(node.id)));

    await this.nodes.bulkPut(nodes);

    // バルク更新イベントを個別に通知
    nodes.forEach((node, index) => {
      const oldNode = oldNodes[index];
      if (oldNode) {
        const changes: {
          name: { old: string; new: string } | undefined;
          parentId: { old: NodeId; new: NodeId } | undefined;
        } = {
          name: undefined,
          parentId: undefined,
        };
        if (oldNode.name !== node.name) {
          changes.name = { old: oldNode.name, new: node.name };
        }
        if (oldNode.parentId !== node.parentId) {
          changes.parentId = { old: oldNode.parentId, new: node.parentId };
        }

        this.changeSubject.next({
          type: 'node-updated' as const,
          nodeId: node.id,
          node: node,
          previousNode: oldNode,
          timestamp: Date.now(),
        });
      }
    });
  }

  async bulkDeleteNodes(nodeIds: NodeId[]): Promise<void> {
    await this.nodes.bulkDelete(nodeIds);

    // バルク削除イベントを個別に通知
    nodeIds.forEach((nodeId) => {
      this.changeSubject.next({
        type: 'node-deleted' as const,
        nodeId: nodeId,
        timestamp: Date.now(),
      });
    });
  }
}
