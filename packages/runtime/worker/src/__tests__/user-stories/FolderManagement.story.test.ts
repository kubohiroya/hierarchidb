/**
 * ユーザーストーリー統合テスト: フォルダ管理
 *
 * React非依存でWorker + UI状態管理の統合をテストします
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createStore } from 'jotai';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import type { NodeId, TreeNode, TreeChangeEvent, TreeId } from '@hierarchidb/common-core';

// UI状態管理用のatoms（実際のファイルから抜粋）
import { atom } from 'jotai';

const selectedNodeIdAtom = atom<NodeId | null, [NodeId | null], void>(
  null,
  (_get, _set, newValue) => newValue
);
const expandedNodesAtom = atom<Set<NodeId>, [Set<NodeId>], void>(
  new Set<NodeId>(),
  (_get, _set, newValue) => newValue
);
const subscribedRootNodeIdAtom = atom<string | null, [string | null], void>(
  null,
  (_get, _set, newValue) => newValue
);
const subscriptionIdAtom = atom<string | null, [string | null], void>(
  null,
  (_get, _set, newValue) => newValue
);

// ノードリストatom（TreeTable相当）
const nodesAtom = atom<Map<NodeId, TreeNode>, [Map<NodeId, TreeNode>], void>(
  new Map(),
  (_get, _set, newValue) => newValue
);
const childrenMapAtom = atom<Map<NodeId, NodeId[]>, [Map<NodeId, NodeId[]>], void>(
  new Map(),
  (_get, _set, newValue) => newValue
);

// 検索状態
const searchQueryAtom = atom<string, [string], void>('', (_get, _set, newValue) => newValue);
const searchResultsAtom = atom<NodeId[], [NodeId[]], void>([], (_get, _set, newValue) => newValue);

/**
 * UI状態とWorkerを統合したテストヘルパー
 */
class UIStateWorkerIntegration {
  private store = createStore();
  private subscriptions: (() => void)[] = [];

  constructor(private workerAPI: WorkerAPIImpl) {}

  /**
   * Worker変更の監視開始
   */
  async startObservingChanges(rootNodeId: NodeId): Promise<void> {
    // Worker側のObservableを購読
    const subscriptionId = await this.workerAPI.subscribeSubtree(rootNodeId, (event) => {
      this.handleWorkerChange(event);
    });

    // Subscription is handled internally by subscribeSubtree

    // UI状態も更新
    this.store.set(subscribedRootNodeIdAtom, rootNodeId);
    this.store.set(subscriptionIdAtom, `sub-${Date.now()}`);
  }

  /**
   * Workerからの変更をUI状態に反映
   */
  private handleWorkerChange(event: TreeChangeEvent): void {
    const currentNodes = this.store.get(nodesAtom);
    const newNodes = new Map(currentNodes);

    switch (event.type) {
      case 'node-created':
        if (event.node) {
          newNodes.set(event.node.id, event.node);
          this.updateChildrenMap(event.node);
        }
        break;

      case 'node-updated':
        if (event.nodeId) {
          const existingNode = newNodes.get(event.nodeId);
          if (existingNode && event.node) {
            const updatedNode = { ...event.node };

            // 親IDが変更された場合（移動）の特別処理
            const oldParentId = existingNode.parentId;
            const newParentId = event.node.parentId;
            newNodes.set(event.nodeId, updatedNode);

            // 親子関係マップを更新（移動の場合）
            if (newParentId && oldParentId !== newParentId) {
              this.moveNodeInChildrenMap(event.nodeId, oldParentId, newParentId);
            }
          }
        }
        break;

      case 'node-deleted':
        if (event.nodeId) {
          newNodes.delete(event.nodeId);
          this.removeFromChildrenMap(event.nodeId);
        }
        break;
    }

    this.store.set(nodesAtom, newNodes);
  }

  /**
   * 親子関係マップの更新
   */
  private updateChildrenMap(node: TreeNode): void {
    const currentMap = this.store.get(childrenMapAtom);
    const newMap = new Map(currentMap);

    const parentId = node.parentId;
    if (parentId) {
      const children = newMap.get(parentId) || [];
      if (!children.includes(node.id)) {
        children.push(node.id);
        newMap.set(parentId, children);
      }
    }

    this.store.set(childrenMapAtom, newMap);
  }

  /**
   * 親子関係マップでのノード移動
   */
  private moveNodeInChildrenMap(nodeId: NodeId, oldParentId: NodeId, newParentId: NodeId): void {
    const currentMap = this.store.get(childrenMapAtom);
    const newMap = new Map(currentMap);

    // 古い親から削除
    const oldChildren = newMap.get(oldParentId) || [];
    const filteredOldChildren = oldChildren.filter((id) => id !== nodeId);
    newMap.set(oldParentId, filteredOldChildren);

    // 新しい親に追加
    const newChildren = newMap.get(newParentId) || [];
    if (!newChildren.includes(nodeId)) {
      newChildren.push(nodeId);
      newMap.set(newParentId, newChildren);
    }

    this.store.set(childrenMapAtom, newMap);
  }

  /**
   * 親子関係マップからの削除
   */
  private removeFromChildrenMap(nodeId: NodeId): void {
    const currentMap = this.store.get(childrenMapAtom);
    const newMap = new Map(currentMap);

    // 子リストから削除
    for (const [parentId, children] of newMap.entries()) {
      const filtered = children.filter((id) => id !== nodeId);
      newMap.set(parentId, filtered);
    }

    // 親としても削除
    newMap.delete(nodeId);

    this.store.set(childrenMapAtom, newMap);
  }

  /**
   * ノード選択
   */
  selectNode(nodeId: NodeId | null): void {
    this.store.set(selectedNodeIdAtom, nodeId);
  }

  /**
   * ノード展開切り替え
   */
  toggleNodeExpansion(nodeId: NodeId): void {
    const expanded = this.store.get(expandedNodesAtom);
    const newExpanded = new Set(expanded);

    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }

    this.store.set(expandedNodesAtom, newExpanded);
  }

  /**
   * 検索実行
   */
  async performSearch(query: string): Promise<void> {
    this.store.set(searchQueryAtom, query);

    if (!query.trim()) {
      this.store.set(searchResultsAtom, []);
      return;
    }

    const rootNodeId = this.store.get(subscribedRootNodeIdAtom);
    if (!rootNodeId) {
      return;
    }

    const results = await this.workerAPI.searchByNameWithDepth({
      rootNodeId: rootNodeId as NodeId,
      query,
      maxDepth: 10,
    });

    const resultIds = results.map((node) => node.id);
    this.store.set(searchResultsAtom, resultIds);
  }

  /**
   * 状態取得ヘルパー
   */
  getState() {
    return {
      selectedNodeId: this.store.get(selectedNodeIdAtom),
      expandedNodes: this.store.get(expandedNodesAtom),
      subscribedRootNodeId: this.store.get(subscribedRootNodeIdAtom),
      subscriptionId: this.store.get(subscriptionIdAtom),
      nodes: this.store.get(nodesAtom),
      childrenMap: this.store.get(childrenMapAtom),
      searchQuery: this.store.get(searchQueryAtom),
      searchResults: this.store.get(searchResultsAtom),
    };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.subscriptions.map((unsubscribe) => unsubscribe());
    this.subscriptions = [];
  }
}

describe.skip('ユーザーストーリー: フォルダ管理 (needs update to new API)', () => {
  let workerAPI: WorkerAPIImpl;
  let uiIntegration: UIStateWorkerIntegration;
  let testTreeId: string;

  beforeEach(async () => {
    workerAPI = new WorkerAPIImpl('test-user-story-db');
    await workerAPI.initialize();

    uiIntegration = new UIStateWorkerIntegration(workerAPI);

    testTreeId = 'test-tree';
  });

  afterEach(async () => {
    uiIntegration.cleanup();
    await workerAPI.dispose();
  });

  describe('Story: ユーザーがプロジェクトフォルダを整理する', () => {
    it('フォルダ作成 → 選択 → 子フォルダ作成 → 検索', async () => {
      const rootNodeId = 'root' as NodeId;

      // Step 1: 変更監視を開始
      await uiIntegration.startObservingChanges(rootNodeId);

      let state = uiIntegration.getState();
      expect(state.subscribedRootNodeId).toBe(rootNodeId);

      // Step 2: プロジェクトフォルダを作成
      const projectResult = await createFolder(workerAPI, testTreeId, 'My Project', rootNodeId);
      expect(projectResult.success).toBe(true);

      const projectNodeId = projectResult.nodeId!;

      // UI状態を手動更新（実際の実装では自動）
      const projectNode: TreeNode = {
        id: projectNodeId,
        parentId: rootNodeId,
        nodeType: 'folder',
        name: 'My Project',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // 変更イベントをシミュレート
      uiIntegration['handleWorkerChange']({
        type: 'node-created',
        nodeId: projectNodeId,
        node: projectNode,
        timestamp: Date.now(),
      });

      state = uiIntegration.getState();
      expect(state.nodes.has(projectNodeId)).toBe(true);
      expect(state.childrenMap.get(rootNodeId)).toContain(projectNodeId);

      // Step 3: プロジェクトフォルダを選択
      uiIntegration.selectNode(projectNodeId);
      state = uiIntegration.getState();
      expect(state.selectedNodeId).toBe(projectNodeId);

      // Step 4: プロジェクトフォルダを展開
      uiIntegration.toggleNodeExpansion(projectNodeId);
      state = uiIntegration.getState();
      expect(state.expandedNodes.has(projectNodeId)).toBe(true);

      // Step 5: 子フォルダを作成（src, docs, tests）
      const subfolders = ['src', 'docs', 'tests'];
      const subfolderIds: NodeId[] = [];

      for (const name of subfolders) {
        const result = await createFolder(workerAPI, testTreeId, name, projectNodeId);
        expect(result.success).toBe(true);

        const subfolderNodeId = result.nodeId!;
        subfolderIds.push(subfolderNodeId);

        // 変更イベントをシミュレート
        const subfolderNode: TreeNode = {
          id: subfolderNodeId,
          parentId: projectNodeId,
          nodeType: 'folder',
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };

        uiIntegration['handleWorkerChange']({
          type: 'node-created',
          nodeId: subfolderNodeId,
          node: subfolderNode,
          timestamp: Date.now(),
        });
      }

      state = uiIntegration.getState();
      expect(state.childrenMap.get(projectNodeId)).toHaveLength(3);
      subfolderIds.forEach((id) => {
        expect(state.nodes.has(id)).toBe(true);
      });

      // Step 6: フォルダを検索
      await uiIntegration.performSearch('src');
      state = uiIntegration.getState();
      expect(state.searchQuery).toBe('src');
      // 検索結果にsrcフォルダが含まれることを確認
      // 注: 実際の検索実装に依存
    });

    it('フォルダ名変更 → 移動 → 削除の操作フロー', async () => {
      const rootNodeId = 'root' as NodeId;

      // 監視開始
      await uiIntegration.startObservingChanges(rootNodeId);

      // 初期フォルダ構造を作成
      const folder1 = await createFolder(workerAPI, testTreeId, 'Folder A', rootNodeId);
      const folder2 = await createFolder(workerAPI, testTreeId, 'Folder B', rootNodeId);

      const folder1Id = folder1.nodeId!;
      const folder2Id = folder2.nodeId!;

      // UI状態に反映
      [
        { id: folder1Id, name: 'Folder A', parent: rootNodeId },
        { id: folder2Id, name: 'Folder B', parent: rootNodeId },
      ].forEach(({ id, name, parent }) => {
        const node: TreeNode = {
          id: id,
          parentId: parent,
          nodeType: 'folder',
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };

        uiIntegration['handleWorkerChange']({
          type: 'node-created',
          nodeId: id,
          node,
          timestamp: Date.now(),
        });
      });

      // Step 1: Folder Aを選択
      uiIntegration.selectNode(folder1Id);
      expect(uiIntegration.getState().selectedNodeId).toBe(folder1Id);

      // Step 2: Folder Aの名前を変更
      const renameResult = await updateFolderName(workerAPI, folder1Id, 'Renamed Folder A');
      expect(renameResult.success).toBe(true);

      // 名前変更イベントをシミュレート
      const existingFolder = uiIntegration.getState().nodes.get(folder1Id);
      if (existingFolder) {
        uiIntegration['handleWorkerChange']({
          type: 'node-updated',
          nodeId: folder1Id,
          node: { ...existingFolder, name: 'Renamed Folder A' },
          previousNode: existingFolder,
          timestamp: Date.now(),
        });
      }

      const state1 = uiIntegration.getState();
      expect(state1.nodes.get(folder1Id)?.name).toBe('Renamed Folder A');

      // Step 3: Folder AをFolder Bの中に移動
      const moveResult = await workerAPI.moveNodes({
        nodeIds: [folder1Id],
        toParentId: folder2Id,
      });

      expect(moveResult.success).toBe(true);

      // 移動イベントをシミュレート
      const movedFolder = uiIntegration.getState().nodes.get(folder1Id);
      if (movedFolder) {
        uiIntegration['handleWorkerChange']({
          type: 'node-updated',
          nodeId: folder1Id,
          node: { ...movedFolder, parentId: folder2Id },
          previousNode: movedFolder,
          timestamp: Date.now(),
        });
      }

      const state2 = uiIntegration.getState();
      expect(state2.nodes.get(folder1Id)?.parentId).toBe(folder2Id);
      expect(state2.childrenMap.get(folder2Id)).toContain(folder1Id);

      // Step 4: Folder Aを削除（ゴミ箱へ）
      const deleteResult = await workerAPI.moveToTrash([folder1Id]);

      expect(deleteResult.success).toBe(true);

      // 削除イベントをシミュレート
      uiIntegration['handleWorkerChange']({
        type: 'node-deleted',
        nodeId: folder1Id,
        timestamp: Date.now(),
      });

      const state3 = uiIntegration.getState();
      expect(state3.nodes.has(folder1Id)).toBe(false);
      expect(state3.selectedNodeId).toBe(folder1Id); // まだ選択中（実際のUIでは選択解除される）

      // Step 5: 選択を解除
      uiIntegration.selectNode(null);
      expect(uiIntegration.getState().selectedNodeId).toBeNull();
    });
  });

  describe('Story: 複数フォルダの一括操作', () => {
    it('複数フォルダ選択 → 一括移動 → 一括削除', async () => {
      const rootNodeId = 'root' as NodeId;

      await uiIntegration.startObservingChanges(rootNodeId);

      // 複数のフォルダを作成
      const folderNames = ['Folder 1', 'Folder 2', 'Folder 3'];
      const folderIds: NodeId[] = [];

      for (const name of folderNames) {
        const result = await createFolder(workerAPI, testTreeId, name, rootNodeId);
        expect(result.success).toBe(true);
        folderIds.push(result.nodeId!);

        // UI状態に反映
        const node: TreeNode = {
          id: result.nodeId!,
          parentId: rootNodeId,
          nodeType: 'folder',
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };

        uiIntegration['handleWorkerChange']({
          type: 'node-created',
          nodeId: result.nodeId!,
          node,
          timestamp: Date.now(),
        });
      }

      // 親フォルダを作成
      const parentResult = await createFolder(workerAPI, testTreeId, 'Parent Folder', rootNodeId);
      const parentId = parentResult.nodeId!;

      // 一括移動
      const moveResult = await workerAPI.moveNodes({
        nodeIds: folderIds,
        toParentId: parentId,
      });

      expect(moveResult.success).toBe(true);

      // 移動イベントをシミュレート
      folderIds.forEach((nodeId) => {
        const existingNode = uiIntegration.getState().nodes.get(nodeId);
        if (existingNode) {
          uiIntegration['handleWorkerChange']({
            type: 'node-updated',
            nodeId,
            node: { ...existingNode, parentId: parentId },
            previousNode: existingNode,
            timestamp: Date.now(),
          });
        }
      });

      const stateAfterMove = uiIntegration.getState();
      folderIds.forEach((nodeId) => {
        expect(stateAfterMove.nodes.get(nodeId)?.parentId).toBe(parentId);
      });

      // 一括削除
      const deleteResult = await workerAPI.moveToTrash(folderIds);

      expect(deleteResult.success).toBe(true);

      // 削除イベントをシミュレート
      folderIds.forEach((nodeId) => {
        uiIntegration['handleWorkerChange']({
          type: 'node-deleted',
          nodeId,
          timestamp: Date.now(),
        });
      });

      const stateAfterDelete = uiIntegration.getState();
      folderIds.forEach((nodeId) => {
        expect(stateAfterDelete.nodes.has(nodeId)).toBe(false);
      });
    });
  });

  describe('Story: 検索とフィルタリング', () => {
    it('フォルダ検索 → 結果から選択 → 詳細表示', async () => {
      const rootNodeId = 'root' as NodeId;

      await uiIntegration.startObservingChanges(rootNodeId);

      // 検索用のフォルダ構造を作成
      const testFolders = [
        'Project Alpha',
        'Project Beta',
        'Documentation',
        'Archive Projects',
        'Test Results',
      ];

      for (const name of testFolders) {
        const result = await createFolder(workerAPI, testTreeId, name, rootNodeId);
        expect(result.success).toBe(true);

        const node: TreeNode = {
          id: result.nodeId!,
          parentId: rootNodeId,
          nodeType: 'folder',
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };

        uiIntegration['handleWorkerChange']({
          type: 'node-created',
          nodeId: result.nodeId!,
          node,
          timestamp: Date.now(),
        });
      }

      // 検索実行: "Project" で検索
      await uiIntegration.performSearch('Project');
      const state = uiIntegration.getState();

      expect(state.searchQuery).toBe('Project');
      expect(state.searchResults.length).toBeGreaterThan(0);

      // 検索結果から最初のアイテムを選択
      if (state.searchResults.length > 0) {
        const firstResult = state.searchResults[0];
        if (firstResult) {
          uiIntegration.selectNode(firstResult);

          expect(uiIntegration.getState().selectedNodeId).toBe(firstResult);
        }
      }

      // 検索クリア
      await uiIntegration.performSearch('');
      expect(uiIntegration.getState().searchQuery).toBe('');
      expect(uiIntegration.getState().searchResults).toHaveLength(0);
    });
  });
});

// ヘルパー関数
async function createFolder(
  api: WorkerAPIImpl,
  treeId: string,
  name: string,
  parentId: NodeId
): Promise<{ success: boolean; nodeId?: NodeId; error?: string }> {
  // 新しい簡易APIを使用
  return await api.createFolder({
    treeId: treeId as TreeId,
    parentNodeId: parentId,
    name,
  });
}

async function updateFolderName(
  api: WorkerAPIImpl,
  nodeId: NodeId,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  // 新しい簡易APIを使用
  return await api.updateFolderName({
    nodeId,
    name: newName,
  });
}
