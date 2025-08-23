import type {
  Timestamp,
  TreeChangeEvent,
  TreeNode,
  NodeId,
  TreeNodeType,
} from '@hierarchidb/00-core';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

/**
 * テスト用のモックCoreDB型定義
 */
export type MockCoreDB = {
  treeNodes: Map<NodeId, TreeNode>;
  getNode: any;
  getChildren: any;
  updateNode: any;
  createNode: any;
  deleteNode: any;
  changeSubject: Subject<TreeChangeEvent>;
};

/**
 * テスト用ノード作成ヘルパー関数
 *
 * 統一されたテストデータを作成するための共通関数です。
 * テストの可読性と保守性を向上させます。
 *
 * @param id ノードID
 * @param parentId 親ノードID
 * @param name ノード名
 * @param type ノード種別（デフォルト: 'folder'）
 * @returns テスト用TreeNodeオブジェクト
 */
export const createTestNode = (
  id: string,
  parentId: string,
  name: string,
  type: TreeNodeType = 'folder'
): TreeNode => ({
  id: id as NodeId,
  parentNodeId: parentId as NodeId,
  name,
  nodeType: type,
  createdAt: Date.now() as Timestamp,
  updatedAt: Date.now() as Timestamp,
  version: 1,
});

/**
 * モックCoreDBを作成します
 *
 * TreeObservableServiceのテストで使用するモックデータベースを
 * 初期化し、必要なメソッドとイベント配信機能を設定します。
 *
 * @returns 設定済みのモックCoreDBインスタンス
 */
export function createMockCoreDB(): MockCoreDB {
  const changeSubject = new Subject<TreeChangeEvent>();

  const coreDB: MockCoreDB = {
    treeNodes: new Map<NodeId, TreeNode>(),
    getNode: vi.fn(),
    getChildren: vi.fn(),
    updateNode: vi.fn(),
    createNode: vi.fn(),
    deleteNode: vi.fn(),
    changeSubject,
  };

  // モックメソッドの実装設定
  setupMockDBMethods(coreDB);

  return coreDB;
}

/**
 * モックDBのメソッド実装を設定します
 *
 * @param coreDB 設定対象のモックCoreDB
 */
function setupMockDBMethods(coreDB: MockCoreDB): void {
  // getNode メソッドの実装
  coreDB.getNode.mockImplementation((id: NodeId) => {
    return Promise.resolve(coreDB.treeNodes.get(id));
  });

  // getChildren メソッドの実装
  coreDB.getChildren.mockImplementation(async (parentId: NodeId) => {
    const children = Array.from(coreDB.treeNodes.values()).filter(
      (n) => n.parentNodeId === parentId
    );
    return children.sort((a, b) => a.createdAt - b.createdAt);
  });

  // updateNode メソッドの実装
  coreDB.updateNode.mockImplementation(async (id: NodeId, data: Partial<TreeNode>) => {
    const node = coreDB.treeNodes.get(id);
    if (node) {
      const updatedNode = { ...node, ...data };
      coreDB.treeNodes.set(id, updatedNode);

      // 変更イベントを発行
      coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: id,
        node: updatedNode,
        previousNode: node,
        timestamp: Date.now() as Timestamp,
      });
    }
  });

  // createNode メソッドの実装
  coreDB.createNode.mockImplementation(async (node: TreeNode) => {
    coreDB.treeNodes.set(node.id, node);

    // 作成イベントを発行
    coreDB.changeSubject.next({
      type: 'node-created',
      nodeId: node.id,
      parentId: node.parentNodeId,
      node,
      timestamp: Date.now() as Timestamp,
    });

    return node.id;
  });

  // deleteNode メソッドの実装
  coreDB.deleteNode.mockImplementation(async (id: NodeId) => {
    const node = coreDB.treeNodes.get(id);
    if (node) {
      coreDB.treeNodes.delete(id);

      // 削除イベントを発行
      coreDB.changeSubject.next({
        type: 'node-deleted',
        nodeId: id,
        previousNode: node,
        timestamp: Date.now() as Timestamp,
      });
    }
  });
}

/**
 * テスト用の階層データを設定します
 *
 * 標準的なテリーファイルシステム構造を作成し、
 * 各テストで一貫した初期状態を提供します。
 *
 * 作成される構造:
 * ```
 * root
 * ├── folder1
 * │   ├── subfolder1
 * │   │   └── file1.txt
 * │   └── file2.txt
 * ├── folder2
 * │   └── document.doc
 * └── folder3 (empty)
 * ```
 *
 * @param coreDB データを設定するモックCoreDB
 */
export function setupTestData(coreDB: MockCoreDB): void {
  const nodes = [
    createTestNode('root', '', 'Root'),
    createTestNode('folder1', 'root', 'Folder 1'),
    createTestNode('folder2', 'root', 'Folder 2'),
    createTestNode('folder3', 'root', 'Empty Folder'),
    createTestNode('subfolder1', 'folder1', 'Subfolder 1'),
  ];

  nodes.forEach((node) => {
    coreDB.treeNodes.set(node.id, node);
  });
}
