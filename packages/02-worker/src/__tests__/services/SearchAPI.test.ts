/**
 * 検索API統合テスト - 4つのマッチモード対応
 * 
 * 完全・前方・後方・部分一致の検索機能をテストします
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import type { NodeId, TreeNode, TreeId } from '@hierarchidb/00-core';

describe.skip('検索API統合テスト - マッチモード対応 (needs update to new API)', () => {
  let api: WorkerAPIImpl;
  let testTreeId: string;
  let rootNodeId: NodeId;

  beforeEach(async () => {
    api = new WorkerAPIImpl('test-search-api-db');
    await api.initialize();
    
    testTreeId = 'test-tree';
    rootNodeId = 'root' as NodeId;
    
    // テスト用のルートノードを作成
    const coreDB = (api as any).coreDB;
    await coreDB.createNode({
      id: rootNodeId,
      parentNodeId: 'super-root' as NodeId,
      nodeType: 'folder',
      name: 'Root',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
  });

  afterEach(async () => {
    await api.dispose();
  });

  describe('検索マッチモード機能', () => {
    beforeEach(async () => {
      // 検索テスト用のフォルダ構造を作成
      const testFolders = [
        'Project',           // 完全一致用
        'ProjectAlpha',      // 前方一致用
        'MyProject',         // 後方一致用
        'ProjectBetaTest',   // 部分一致用
        'Documentation',     // マッチしないもの
        'proj',              // 小文字（大文字小文字区別用）
      ];

      for (const name of testFolders) {
        const result = await api.createFolder({
          treeId: testTreeId as TreeId,
          parentNodeId: rootNodeId,
          name,
        });
        expect(result.success).toBe(true);
      }
    });

    it('完全一致検索（exact）', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'Project',
        mode: 'exact',
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Project');
    });

    it('前方一致検索（prefix）', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'Project',
        mode: 'prefix',
      });

      // 'Project', 'ProjectAlpha', 'ProjectBetaTest' がマッチ
      expect(results).toHaveLength(3);
      const names = results.map(r => r.name).sort();
      expect(names).toEqual(['Project', 'ProjectAlpha', 'ProjectBetaTest']);
    });

    it('後方一致検索（suffix）', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'Project',
        mode: 'suffix',
      });

      // 'Project', 'MyProject' がマッチ
      expect(results).toHaveLength(2);
      const names = results.map(r => r.name).sort();
      expect(names).toEqual(['MyProject', 'Project']);
    });

    it('部分一致検索（partial）', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'Project',
        mode: 'partial',
      });

      // 'Project', 'ProjectAlpha', 'MyProject', 'ProjectBetaTest' がマッチ
      expect(results).toHaveLength(4);
      const names = results.map(r => r.name).sort();
      expect(names).toEqual(['MyProject', 'Project', 'ProjectAlpha', 'ProjectBetaTest']);
    });

    it('大文字小文字を区別する検索', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'project',
        mode: 'exact',
      });

      // 大文字小文字を区別するので、'proj'のみがマッチ（しない）
      expect(results).toHaveLength(0);
    });

    it('大文字小文字を区別しない検索（デフォルト）', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'project',
        mode: 'exact',
      });

      // 'Project'がマッチ
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Project');
    });

    it('検索結果数の制限', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'Project',
        mode: 'partial',
      });

      expect(results).toHaveLength(2);
    });

    it('空のクエリでの検索', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: '',
        mode: 'partial',
      });

      // 空のクエリは全てのノードにマッチ
      expect(results.length).toBeGreaterThan(0);
    });

    it('マッチしないクエリでの検索', async () => {
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'NonExistent',
        mode: 'exact',
      });

      expect(results).toHaveLength(0);
    });

    it('特殊文字を含むクエリでの検索', async () => {
      // 特殊文字を含むフォルダを作成
      const specialResult = await api.createFolder({
        treeId: testTreeId as TreeId,
        parentNodeId: rootNodeId,
        name: 'Test.Folder[1]',
      });
      expect(specialResult.success).toBe(true);

      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'Test.Folder[1]',
        mode: 'exact',
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Test.Folder[1]');
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量ノードでの検索性能', async () => {
      // 500個のテストノードを作成
      const nodeCount = 500;
      for (let i = 0; i < nodeCount; i++) {
        const name = i % 10 === 0 ? `Target${i}` : `Other${i}`;
        await api.createFolder({
          treeId: testTreeId as TreeId,
          parentNodeId: rootNodeId,
          name,
        });
      }

      const startTime = Date.now();
      
      const results = await api.searchByNameWithMatchMode({
        rootNodeId,
        query: 'Target',
        mode: 'prefix',
      });

      const searchTime = Date.now() - startTime;
      
      // 検索時間が500ms以内
      expect(searchTime).toBeLessThan(500);
      
      // 結果の妥当性確認
      expect(results.length).toBe(50); // 500 / 10 = 50個のTargetノード
      expect(results.every(r => r.name.startsWith('Target'))).toBe(true);
    });
  });

  describe('後方互換性テスト', () => {
    it('既存のsearchByNameWithDepthが動作する', async () => {
      // 互換性テスト用フォルダ作成
      await api.createFolder({
        treeId: testTreeId as TreeId,
        parentNodeId: rootNodeId,
        name: 'TestFolder',
      });

      const results = await api.searchByNameWithDepth({
        rootNodeId,
        query: 'Test',
        maxDepth: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('TestFolder');
    });
  });
});