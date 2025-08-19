import type { Timestamp, TreeNode, TreeNodeId } from '@hierarchidb/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { duplicateBranch, getAllDescendants, groupDescendants } from '../AdvancedTreeOperations';

// モックデータベース用の型定義
type MockDB = {
  treeNodes: {
    add: (node: TreeNode) => Promise<TreeNodeId>;
    bulkAdd: (nodes: TreeNode[]) => Promise<void>;
    get: (id: TreeNodeId) => Promise<TreeNode | undefined>;
    where: (field: string) => {
      equals: (value: TreeNodeId) => {
        toArray: () => Promise<TreeNode[]>;
      };
    };
  };
};

describe('AdvancedTreeOperations', () => {
  let db: MockDB;
  let mockNodes: Map<TreeNodeId, TreeNode>;

  beforeEach(() => {
    // モックデータベースの初期化
    mockNodes = new Map();

    db = {
      treeNodes: {
        add: async (node: TreeNode) => {
          mockNodes.set(node.treeNodeId, node);
          return node.treeNodeId;
        },
        bulkAdd: async (nodes: TreeNode[]) => {
          nodes.forEach((node) => mockNodes.set(node.treeNodeId, node));
        },
        get: async (id: TreeNodeId) => {
          return mockNodes.get(id);
        },
        where: (field: string) => ({
          equals: (value: TreeNodeId) => ({
            toArray: async () => {
              if (field === 'parentTreeNodeId') {
                return Array.from(mockNodes.values()).filter((n) => n.parentTreeNodeId === value);
              }
              return [];
            },
          }),
        }),
      },
    };
  });

  afterEach(() => {
    mockNodes.clear();
  });

  // テストヘルパー関数
  function createTestNode(id: string, parentId: string | null, name: string): TreeNode {
    return {
      treeNodeId: id as TreeNodeId,
      parentTreeNodeId: parentId as TreeNodeId,
      name,
      treeNodeType: 'folder',
      createdAt: Date.now() as Timestamp,
      updatedAt: Date.now() as Timestamp,
      version: 1,
    };
  }

  async function setupTestTree(
    nodes: Array<{ id: string; parentId: string | null; name: string }>
  ) {
    const treeNodes = nodes.map((node) => createTestNode(node.id, node.parentId, node.name));
    await db.treeNodes.bulkAdd(treeNodes);
  }

  describe('duplicateBranch', () => {
    describe('Phase 1: Basic Functionality', () => {
      it('TC-DB-001: should duplicate a single leaf node', async () => {
        // Given: 単一のリーフノード
        const sourceNode = createTestNode('leaf-1', 'parent-1', 'Test Leaf');
        await db.treeNodes.add(sourceNode);

        // When: 複製実行
        const idMapping = new Map<TreeNodeId, TreeNodeId>();
        await duplicateBranch(
          db as any,
          'leaf-1' as TreeNodeId,
          'new-parent' as TreeNodeId,
          idMapping
        );

        // Then: 新しいノードが作成される
        expect(idMapping.size).toBe(1);
        const newId = idMapping.get('leaf-1' as TreeNodeId);
        expect(newId).toBeDefined();

        const duplicatedNode = await db.treeNodes.get(newId!);
        expect(duplicatedNode).toBeDefined();
        expect(duplicatedNode!.name).toBe('Test Leaf (Copy)');
        expect(duplicatedNode!.parentTreeNodeId).toBe('new-parent');
        expect(duplicatedNode!.treeNodeId).not.toBe('leaf-1');
      });

      it('TC-DB-002: should duplicate a small branch with children', async () => {
        // Given: 親ノードと2つの子ノード
        await setupTestTree([
          { id: 'parent-1', parentId: 'root', name: 'Parent' },
          { id: 'child-1', parentId: 'parent-1', name: 'Child 1' },
          { id: 'child-2', parentId: 'parent-1', name: 'Child 2' },
        ]);

        // When: 親ノードを複製
        const idMapping = new Map<TreeNodeId, TreeNodeId>();
        await duplicateBranch(
          db as any,
          'parent-1' as TreeNodeId,
          'new-root' as TreeNodeId,
          idMapping
        );

        // Then: 3つのノードすべてが複製される
        expect(idMapping.size).toBe(3);

        // 親ノードの確認
        const newParentId = idMapping.get('parent-1' as TreeNodeId);
        expect(newParentId).toBeDefined();

        const newParent = await db.treeNodes.get(newParentId!);
        expect(newParent).toBeDefined();
        expect(newParent!.name).toBe('Parent (Copy)');
        expect(newParent!.parentTreeNodeId).toBe('new-root');

        // 子ノードの確認
        const newChild1Id = idMapping.get('child-1' as TreeNodeId);
        const newChild1 = await db.treeNodes.get(newChild1Id!);
        expect(newChild1).toBeDefined();
        expect(newChild1!.name).toBe('Child 1'); // 子は(Copy)なし
        expect(newChild1!.parentTreeNodeId).toBe(newParentId);

        const newChild2Id = idMapping.get('child-2' as TreeNodeId);
        const newChild2 = await db.treeNodes.get(newChild2Id!);
        expect(newChild2).toBeDefined();
        expect(newChild2!.name).toBe('Child 2');
        expect(newChild2!.parentTreeNodeId).toBe(newParentId);
      });

      it('TC-DB-004: should not add (Copy) suffix when branchRootMode is false', async () => {
        // Given: テストノード
        await db.treeNodes.add(createTestNode('source', 'root', 'Original'));

        // When: branchRootMode=false で複製
        const idMapping = new Map<TreeNodeId, TreeNodeId>();
        await duplicateBranch(
          db as any,
          'source' as TreeNodeId,
          'new-parent' as TreeNodeId,
          idMapping,
          false
        );

        // Then: (Copy)が付かない
        const newId = idMapping.get('source' as TreeNodeId);
        const newNode = await db.treeNodes.get(newId!);
        expect(newNode!.name).toBe('Original');
      });
    });

    describe('Phase 2: Error Handling', () => {
      it('TC-DB-E001: should throw error for non-existent source node', async () => {
        const idMapping = new Map<TreeNodeId, TreeNodeId>();

        await expect(
          duplicateBranch(
            db as any,
            'non-existent' as TreeNodeId,
            'parent' as TreeNodeId,
            idMapping
          )
        ).rejects.toThrow('Source node not found');
      });

      it('TC-DB-E002: should throw error for non-existent parent node', async () => {
        await db.treeNodes.add(createTestNode('source', 'root', 'Test'));
        const idMapping = new Map<TreeNodeId, TreeNodeId>();

        await expect(
          duplicateBranch(
            db as any,
            'source' as TreeNodeId,
            'non-existent-parent' as TreeNodeId,
            idMapping
          )
        ).rejects.toThrow('Parent node not found');
      });

      it('TC-DB-E003: should detect and prevent circular references', async () => {
        // Given: 循環参照のあるデータ（テスト用の不正データ）
        await setupCircularReferenceData();
        const idMapping = new Map<TreeNodeId, TreeNodeId>();

        // When/Then: エラーが発生する
        await expect(
          duplicateBranch(
            db as any,
            'circular-root' as TreeNodeId,
            'new-parent' as TreeNodeId,
            idMapping
          )
        ).rejects.toThrow('Circular reference detected');
      });
    });
  });

  // テストヘルパー関数: 循環参照データのセットアップ
  async function setupCircularReferenceData() {
    // 循環参照を作成（通常のデータベース制約を回避したテスト用データ）
    const nodes = [
      createTestNode('circular-root', 'circular-child', 'Circular Root'),
      createTestNode('circular-child', 'circular-root', 'Circular Child'),
    ];
    await db.treeNodes.bulkAdd(nodes);
  }

  describe('groupDescendants', () => {
    describe('Phase 3: Basic Functionality', () => {
      it('TC-GD-001: should identify top-level nodes correctly', async () => {
        // Given: 親子関係のあるノード群
        await setupTestTree([
          { id: 'parent-1', parentId: 'root', name: 'Parent 1' },
          { id: 'child-1-1', parentId: 'parent-1', name: 'Child 1-1' },
          { id: 'child-1-2', parentId: 'parent-1', name: 'Child 1-2' },
          { id: 'parent-2', parentId: 'root', name: 'Parent 2' },
          { id: 'independent', parentId: 'other-root', name: 'Independent' },
        ]);

        // When: 全ノードでグループ化
        const nodeIds = ['parent-1', 'child-1-1', 'child-1-2', 'parent-2', 'independent'];
        const topLevelNodes = await groupDescendants(
          db as any,
          nodeIds.map((id) => id as TreeNodeId)
        );

        // Then: 親ノードのみが抽出される
        expect(topLevelNodes).toHaveLength(3);
        const topLevelIds = topLevelNodes.map((n) => n.treeNodeId);
        expect(topLevelIds).toContain('parent-1');
        expect(topLevelIds).toContain('parent-2');
        expect(topLevelIds).toContain('independent');
        expect(topLevelIds).not.toContain('child-1-1');
        expect(topLevelIds).not.toContain('child-1-2');
      });

      it('TC-GD-002: should handle complex hierarchies', async () => {
        // Given: 複雑な階層構造
        await setupTestTree([
          { id: 'root-1', parentId: 'super-root', name: 'Root 1' },
          { id: 'level-1-1', parentId: 'root-1', name: 'Level 1-1' },
          { id: 'level-2-1', parentId: 'level-1-1', name: 'Level 2-1' },
          { id: 'level-1-2', parentId: 'root-1', name: 'Level 1-2' },
          { id: 'root-2', parentId: 'super-root', name: 'Root 2' },
        ]);

        // When: 混合レベルのノードでグループ化
        const nodeIds = ['root-1', 'level-2-1', 'level-1-2', 'root-2'];
        const topLevelNodes = await groupDescendants(
          db as any,
          nodeIds.map((id) => id as TreeNodeId)
        );

        // Then: 最上位ノードのみ
        expect(topLevelNodes).toHaveLength(2);
        const topLevelIds = topLevelNodes.map((n) => n.treeNodeId);
        expect(topLevelIds).toContain('root-1');
        expect(topLevelIds).toContain('root-2');
        expect(topLevelIds).not.toContain('level-2-1');
        expect(topLevelIds).not.toContain('level-1-2');
      });
    });

    describe('Edge Cases', () => {
      it('TC-GD-E001: should return empty array for empty input', async () => {
        const result = await groupDescendants(db as any, []);
        expect(result).toEqual([]);
      });

      it('TC-GD-E002: should ignore non-existent nodes', async () => {
        await db.treeNodes.add(createTestNode('existing', 'root', 'Existing'));

        const result = await groupDescendants(
          db as any,
          ['existing', 'non-existent'].map((id) => id as TreeNodeId)
        );

        expect(result).toHaveLength(1);
        expect(result[0].treeNodeId).toBe('existing');
      });
    });
  });

  describe('getAllDescendants', () => {
    describe('Phase 4: Basic Functionality', () => {
      it('TC-GAD-001: should get all descendants in correct order', async () => {
        // Given: ツリー構造
        await setupTestTree([
          { id: 'root', parentId: null, name: 'Root' },
          { id: 'child-1', parentId: 'root', name: 'Child 1' },
          { id: 'child-2', parentId: 'root', name: 'Child 2' },
          { id: 'grandchild-1', parentId: 'child-1', name: 'Grandchild 1' },
        ]);

        // When: 全子孫を取得
        const descendants = await getAllDescendants(db as any, 'root' as TreeNodeId);

        // Then: 全子孫が取得される（BFS順序）
        expect(descendants).toHaveLength(3);
        expect(descendants).toEqual(['child-1', 'child-2', 'grandchild-1']);
      });

      it('TC-GAD-002: should return empty array for leaf nodes', async () => {
        await db.treeNodes.add(createTestNode('leaf', 'parent', 'Leaf'));

        const descendants = await getAllDescendants(db as any, 'leaf' as TreeNodeId);

        expect(descendants).toEqual([]);
      });
    });

    describe('Error Handling', () => {
      it('TC-GAD-E001: should return empty array for non-existent node', async () => {
        const descendants = await getAllDescendants(db as any, 'non-existent' as TreeNodeId);
        expect(descendants).toEqual([]);
      });
    });
  });

  describe('Integration Tests', () => {
    it('TC-INT-001: should work correctly with duplicated branches', async () => {
      // Given: 元のツリー構造
      await setupTestTree([
        { id: 'original-root', parentId: 'super-root', name: 'Original' },
        { id: 'original-child', parentId: 'original-root', name: 'Child' },
      ]);

      // When: 複製してからグループ化
      const idMapping = new Map<TreeNodeId, TreeNodeId>();
      await duplicateBranch(
        db as any,
        'original-root' as TreeNodeId,
        'new-parent' as TreeNodeId,
        idMapping
      );

      const allNodes = [
        'original-root',
        'original-child',
        idMapping.get('original-root' as TreeNodeId),
        idMapping.get('original-child' as TreeNodeId),
      ].filter(Boolean) as TreeNodeId[];

      const topLevel = await groupDescendants(db as any, allNodes);

      // Then: オリジナルとコピーの両方のルートが取得される
      expect(topLevel).toHaveLength(2);
      const topLevelIds = topLevel.map((n) => n.treeNodeId);
      expect(topLevelIds).toContain('original-root');
      expect(topLevelIds).toContain(idMapping.get('original-root' as TreeNodeId));
    });

    it('TC-INT-002: should work with getAllDescendants after duplication', async () => {
      // Given: 元のツリー構造
      await setupTestTree([
        { id: 'tree-root', parentId: null, name: 'Tree Root' },
        { id: 'branch-1', parentId: 'tree-root', name: 'Branch 1' },
        { id: 'leaf-1', parentId: 'branch-1', name: 'Leaf 1' },
      ]);

      // When: ブランチを複製
      const idMapping = new Map<TreeNodeId, TreeNodeId>();
      await duplicateBranch(
        db as any,
        'branch-1' as TreeNodeId,
        'tree-root' as TreeNodeId,
        idMapping
      );

      // Then: 元のツリーと複製後のツリーで正しい子孫が取得される
      const originalDescendants = await getAllDescendants(db as any, 'tree-root' as TreeNodeId);
      expect(originalDescendants).toHaveLength(3); // branch-1, leaf-1, branch-1(copy)

      // 複製されたブランチの子孫も正しく取得される
      const duplicatedBranchId = idMapping.get('branch-1' as TreeNodeId);
      const duplicatedDescendants = await getAllDescendants(db as any, duplicatedBranchId!);
      expect(duplicatedDescendants).toHaveLength(1); // leaf-1(copy)
    });
  });

  describe('Performance Tests', () => {
    it('TC-P-001: should handle medium-scale operations efficiently', async () => {
      // Given: 中規模ツリーデータ（100ノード）
      await setupMediumTestTree(100);

      const startTime = performance.now();

      // When: 各操作を実行
      const idMapping = new Map<TreeNodeId, TreeNodeId>();
      await duplicateBranch(
        db as any,
        'medium-root' as TreeNodeId,
        'new-parent' as TreeNodeId,
        idMapping
      );

      const allDescendants = await getAllDescendants(db as any, 'medium-root' as TreeNodeId);

      const groupIds = Array.from(idMapping.keys()).slice(0, 20);
      const topLevel = await groupDescendants(db as any, groupIds);

      const endTime = performance.now();

      // Then: パフォーマンス要件を満たす（中規模データで5秒以内）
      expect(endTime - startTime).toBeLessThan(5000);
      expect(idMapping.size).toBe(100);
      expect(allDescendants.length).toBe(99);
      expect(topLevel.length).toBeGreaterThan(0);
    });
  });

  // 中規模テストデータのセットアップ
  async function setupMediumTestTree(nodeCount: number) {
    const nodes = [];

    // ルートノード作成
    nodes.push(createTestNode('medium-root', null, 'Medium Root'));

    // バランス取れたツリー構造を生成（各ノードに最大10の子）
    for (let i = 1; i < nodeCount; i++) {
      const parentId = i === 1 ? 'medium-root' : `node-${Math.floor((i - 1) / 10)}`;
      nodes.push(createTestNode(`node-${i}`, parentId, `Node ${i}`));
    }

    await db.treeNodes.bulkAdd(nodes);
  }
});
