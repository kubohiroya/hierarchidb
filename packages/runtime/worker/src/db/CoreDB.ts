import {
  type Tree,
  type TreeNode,
  type NodeId,
  type TreeId,
  type TreeRootState,
  type TreeChangeEvent,
  NodeIdGenerator,
  TREE_ROOT_NODE_TYPES,
  SingletonMixin,
} from '@hierarchidb/common-core';
import Dexie, { type Table } from 'dexie';
import { Subject } from 'rxjs';

export class CoreDB extends Dexie {
  trees!: Table<Tree, TreeId>;
  nodes!: Table<TreeNode, NodeId>;
  rootStates!: Table<TreeRootState, NodeId>;

  // イベント通知用のSubject
  public readonly changeSubject = new Subject<TreeChangeEvent>();

  static async getSingleton(name: string = 'hierarchidb'): Promise<CoreDB> {
    return SingletonMixin.getSingleton(CoreDB.name, async () => {
      const instance = new CoreDB(name);
      await instance.open();
      await instance.initialize();
      return instance;
    });
  }

  private constructor(name: string) {
    super(`${name}-CoreDB`);

    // Increment version to force schema update
    this.version(3)
      .stores({
        trees: '&id, rootId, trashRootId, superRootId',
        nodes: [
          '&id',
          'parentId',
          '&[parentId+name]',
          '[parentId+updatedAt]',
          'removedAt',
          'originalParentId',
          '*references',
        ].join(', '),
        // Fix: rootStates should use a composite key since rootNodeId might not be unique across trees
        rootStates: '&rootNodeId',
      })
      .upgrade(async (tx) => {
        // Clear all data to start fresh

        await tx.table('trees').clear();
        await tx.table('nodes').clear();
        await tx.table('rootStates').clear();
      });
  }

  private treeIdToTreeName(treeId: string): string {
    return treeId === 'r' ? 'Resources' : 'Projects';
  }

  async initialize(): Promise<void> {
await this.transaction('rw', this.trees, this.nodes, this.rootStates, async () => {
      const now = Date.now();

      // Check database state
      const treesCount = await this.trees.count();
      const nodesCount = await this.nodes.count();
      const rootStatesCount = await this.rootStates.count();

// If database is partially initialized, clear it and start fresh
      if (treesCount != 2 || rootStatesCount != 4) {
        console.warn('Database is in an inconsistent state. Clearing and reinitializing...');
        await this.trees.clear();
        await this.nodes.clear();
        await this.rootStates.clear();
      }

      if (treesCount === 0) {
        await this.trees.bulkPut(
          ['r', 'p'].map((treeId) => ({
            id: treeId as TreeId,
            name: treeId === 'r' ? 'Resources' : 'Projects',
            rootId: NodeIdGenerator.rootNode(treeId),
            trashRootId: NodeIdGenerator.trashNode(treeId),
            superRootId: NodeIdGenerator.superRootNode(treeId),
          }))
        );
      }
      if (nodesCount === 0) {
        const data = ['r', 'p'].flatMap((treeId) => [
          {
            parentId: NodeIdGenerator.superRootNode(treeId),
            id: NodeIdGenerator.rootNode(treeId),
            nodeType: TREE_ROOT_NODE_TYPES.ROOT,
            name: treeId === 'r' ? 'Resources' : 'Projects',
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
await this.nodes.bulkAdd(data);
      }

      if (rootStatesCount === 0) {
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

try {
          await this.rootStates.bulkAdd(rootStateData);
        } catch (error) {
          console.error('Failed to initialize rootStates:', error);
          console.error('Data that failed:', rootStateData);

          // Try to get more details about the error
          if ((error as any).failures) {
            console.error('Bulk add failures:', (error as any).failures);
          }
          throw error;
        }
      }
      
});
  }

  async getTree(treeId: TreeId): Promise<Tree | undefined> {
    console.log('[CoreDB] getTree called with treeId:', treeId);
    try {
      const tree = await this.trees.get(treeId);
      console.log('[CoreDB] getTree result:', tree);
      
      // Ensure we return a plain object that can be serialized by Comlink
      if (tree) {
        const plainTree: Tree = {
          id: tree.id,
          name: tree.name,
          rootId: tree.rootId,
          trashRootId: tree.trashRootId,
          superRootId: tree.superRootId,
        };
        return plainTree;
      }
      
      return undefined;
    } catch (error) {
      console.error('[CoreDB] getTree error:', error);
      throw error;
    }
  }

  async listTrees(): Promise<Tree[]> {
    const trees = await this.trees.toArray();
    
    // Ensure we return plain objects that can be serialized by Comlink
    return trees.map((tree): Tree => ({
      id: tree.id,
      name: tree.name,
      rootId: tree.rootId,
      trashRootId: tree.trashRootId,
      superRootId: tree.superRootId,
    }));
  }

  // CRUD operations for TreeNode
  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    // Validate nodeId to prevent Dexie errors
    if (!nodeId || typeof nodeId !== 'string' || nodeId.length === 0) {
      console.warn('Invalid nodeId provided to CoreDB.getNode:', nodeId);
      return undefined;
    }

    const node = await this.nodes.get(nodeId);
    
    // Ensure we return a plain object that can be serialized by Comlink
    if (node) {
      const plainNode: TreeNode = {
        id: node.id,
        parentId: node.parentId,
        nodeType: node.nodeType,
        name: node.name,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        version: node.version,
        ...(node.removedAt && { removedAt: node.removedAt }),
        ...(node.originalParentId && { originalParentId: node.originalParentId }),
        ...(node.references && { references: node.references }),
      };
      return plainNode;
    }
    
    return undefined;
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

    // Ensure we return plain objects that can be serialized by Comlink
    return children.map((node): TreeNode => ({
      id: node.id,
      parentId: node.parentId,
      nodeType: node.nodeType,
      name: node.name,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      version: node.version,
      ...(node.removedAt && { removedAt: node.removedAt }),
      ...(node.originalParentId && { originalParentId: node.originalParentId }),
      ...(node.references && { references: node.references }),
    }));
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
