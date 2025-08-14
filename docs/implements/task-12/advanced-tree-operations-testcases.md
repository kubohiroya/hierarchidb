# 高度なツリー操作実装 - テストケース設計書

## 1. テスト戦略

### 1.1 TDD開発アプローチ

1. **Red**: 失敗するテストを先に作成
2. **Green**: テストを通すための最小限実装
3. **Refactor**: コード品質向上とパフォーマンス最適化

### 1.2 テスト分類

- **Unit Tests**: 各関数の独立したテスト
- **Integration Tests**: データベースとの統合テスト  
- **Performance Tests**: 大規模データでの性能テスト
- **Error Handling Tests**: エラー条件での動作テスト

## 2. duplicateBranch関数のテストケース

### 2.1 正常系テスト

#### TC-DB-001: 単一ノード複製
```typescript
describe('duplicateBranch - Single Node', () => {
  it('should duplicate a single leaf node', async () => {
    // Given: 単一のリーフノード
    const sourceNode = createTestNode('leaf-1', 'parent-1', 'Test Leaf');
    await db.treeNodes.add(sourceNode);
    
    // When: 複製実行
    const idMapping = new Map();
    await duplicateBranch(db, 'leaf-1', 'new-parent', idMapping);
    
    // Then: 新しいノードが作成される
    expect(idMapping.size).toBe(1);
    const newId = idMapping.get('leaf-1');
    const duplicatedNode = await db.treeNodes.get(newId);
    
    expect(duplicatedNode).toBeDefined();
    expect(duplicatedNode.name).toBe('Test Leaf (Copy)');
    expect(duplicatedNode.parentTreeNodeId).toBe('new-parent');
  });
});
```

#### TC-DB-002: 小規模ブランチ複製
```typescript
it('should duplicate a small branch with children', async () => {
  // Given: 親ノードと2つの子ノード
  await setupTestTree([
    { id: 'parent-1', parentId: 'root', name: 'Parent' },
    { id: 'child-1', parentId: 'parent-1', name: 'Child 1' },
    { id: 'child-2', parentId: 'parent-1', name: 'Child 2' }
  ]);
  
  // When: 親ノードを複製
  const idMapping = new Map();
  await duplicateBranch(db, 'parent-1', 'new-root', idMapping);
  
  // Then: 3つのノードすべてが複製される
  expect(idMapping.size).toBe(3);
  
  // 親ノードの確認
  const newParentId = idMapping.get('parent-1');
  const newParent = await db.treeNodes.get(newParentId);
  expect(newParent.name).toBe('Parent (Copy)');
  expect(newParent.parentTreeNodeId).toBe('new-root');
  
  // 子ノードの確認
  const newChild1 = await db.treeNodes.get(idMapping.get('child-1'));
  expect(newChild1.name).toBe('Child 1'); // 子は(Copy)なし
  expect(newChild1.parentTreeNodeId).toBe(newParentId);
});
```

#### TC-DB-003: 深い階層のブランチ複製
```typescript
it('should duplicate deep nested branch', async () => {
  // Given: 5階層の深いツリー
  await setupDeepTestTree(5); // root -> level1 -> level2 -> level3 -> level4 -> leaf
  
  // When: ルートから複製
  const idMapping = new Map();
  await duplicateBranch(db, 'level1', 'new-root', idMapping);
  
  // Then: 全階層が正確に複製される
  expect(idMapping.size).toBe(5);
  
  // 階層構造の検証
  const newLevel1 = await db.treeNodes.get(idMapping.get('level1'));
  const newLevel2 = await db.treeNodes.get(idMapping.get('level2'));
  
  expect(newLevel1.parentTreeNodeId).toBe('new-root');
  expect(newLevel2.parentTreeNodeId).toBe(idMapping.get('level1'));
});
```

#### TC-DB-004: branchRootMode=false のテスト
```typescript
it('should not add (Copy) suffix when branchRootMode is false', async () => {
  // Given: テストノード
  await db.treeNodes.add(createTestNode('source', 'root', 'Original'));
  
  // When: branchRootMode=false で複製
  const idMapping = new Map();
  await duplicateBranch(db, 'source', 'new-parent', idMapping, false);
  
  // Then: (Copy)が付かない
  const newNode = await db.treeNodes.get(idMapping.get('source'));
  expect(newNode.name).toBe('Original');
});
```

### 2.2 異常系テスト

#### TC-DB-E001: 存在しないソースノード
```typescript
it('should throw error for non-existent source node', async () => {
  const idMapping = new Map();
  
  await expect(duplicateBranch(db, 'non-existent', 'parent', idMapping))
    .rejects.toThrow('Source node not found');
});
```

#### TC-DB-E002: 存在しない親ノード
```typescript
it('should throw error for non-existent parent node', async () => {
  await db.treeNodes.add(createTestNode('source', 'root', 'Test'));
  const idMapping = new Map();
  
  await expect(duplicateBranch(db, 'source', 'non-existent-parent', idMapping))
    .rejects.toThrow('Parent node not found');
});
```

#### TC-DB-E003: 循環参照の検出
```typescript
it('should detect and prevent circular references', async () => {
  // Given: 循環参照のあるデータ（テスト用の不正データ）
  await setupCircularReferenceData();
  const idMapping = new Map();
  
  // When/Then: エラーが発生する
  await expect(duplicateBranch(db, 'circular-root', 'new-parent', idMapping))
    .rejects.toThrow('Circular reference detected');
});
```

### 2.3 パフォーマンステスト

#### TC-DB-P001: 大規模ブランチ複製
```typescript
it('should handle large branch duplication efficiently', async () => {
  // Given: 1000ノードのブランチ
  await setupLargeTestTree(1000);
  
  const startTime = performance.now();
  const idMapping = new Map();
  
  // When: 大規模複製実行
  await duplicateBranch(db, 'large-root', 'new-parent', idMapping);
  
  const endTime = performance.now();
  
  // Then: 性能要件を満たす
  expect(endTime - startTime).toBeLessThan(30000); // 30秒以内
  expect(idMapping.size).toBe(1000);
});
```

## 3. groupDescendants関数のテストケース

### 3.1 正常系テスト

#### TC-GD-001: 基本的なグループ化
```typescript
describe('groupDescendants - Basic Grouping', () => {
  it('should identify top-level nodes correctly', async () => {
    // Given: 親子関係のあるノード群
    await setupTestTree([
      { id: 'parent-1', parentId: 'root', name: 'Parent 1' },
      { id: 'child-1-1', parentId: 'parent-1', name: 'Child 1-1' },
      { id: 'child-1-2', parentId: 'parent-1', name: 'Child 1-2' },
      { id: 'parent-2', parentId: 'root', name: 'Parent 2' },
      { id: 'independent', parentId: 'other-root', name: 'Independent' }
    ]);
    
    // When: 全ノードでグループ化
    const nodeIds = ['parent-1', 'child-1-1', 'child-1-2', 'parent-2', 'independent'];
    const topLevelNodes = await groupDescendants(db, nodeIds);
    
    // Then: 親ノードのみが抽出される
    expect(topLevelNodes).toHaveLength(3);
    const topLevelIds = topLevelNodes.map(n => n.treeNodeId);
    expect(topLevelIds).toContain('parent-1');
    expect(topLevelIds).toContain('parent-2');
    expect(topLevelIds).toContain('independent');
    expect(topLevelIds).not.toContain('child-1-1');
    expect(topLevelIds).not.toContain('child-1-2');
  });
});
```

#### TC-GD-002: 複雑な階層のグループ化
```typescript
it('should handle complex hierarchies', async () => {
  // Given: 複雑な階層構造
  await setupTestTree([
    { id: 'root-1', parentId: 'super-root', name: 'Root 1' },
    { id: 'level-1-1', parentId: 'root-1', name: 'Level 1-1' },
    { id: 'level-2-1', parentId: 'level-1-1', name: 'Level 2-1' },
    { id: 'level-1-2', parentId: 'root-1', name: 'Level 1-2' },
    { id: 'root-2', parentId: 'super-root', name: 'Root 2' }
  ]);
  
  // When: 混合レベルのノードでグループ化
  const nodeIds = ['root-1', 'level-2-1', 'level-1-2', 'root-2'];
  const topLevelNodes = await groupDescendants(db, nodeIds);
  
  // Then: 最上位ノードのみ
  expect(topLevelNodes).toHaveLength(2);
  expect(topLevelNodes.map(n => n.treeNodeId)).toEqual(
    expect.arrayContaining(['root-1', 'root-2'])
  );
});
```

### 3.2 エッジケーステスト

#### TC-GD-E001: 空の入力配列
```typescript
it('should return empty array for empty input', async () => {
  const result = await groupDescendants(db, []);
  expect(result).toEqual([]);
});
```

#### TC-GD-E002: 存在しないノード
```typescript
it('should ignore non-existent nodes', async () => {
  await db.treeNodes.add(createTestNode('existing', 'root', 'Existing'));
  
  const result = await groupDescendants(db, ['existing', 'non-existent']);
  
  expect(result).toHaveLength(1);
  expect(result[0].treeNodeId).toBe('existing');
});
```

#### TC-GD-E003: 循環参照データでの処理
```typescript
it('should handle circular references safely', async () => {
  // Given: 循環参照のあるテストデータ
  await setupCircularReferenceData();
  
  // When/Then: エラーを投げずに安全に処理
  await expect(groupDescendants(db, ['circular-1', 'circular-2']))
    .resolves.not.toThrow();
});
```

## 4. getAllDescendants関数のテストケース

### 4.1 正常系テスト

#### TC-GAD-001: 基本的な子孫取得
```typescript
describe('getAllDescendants - Basic Functionality', () => {
  it('should get all descendants in correct order', async () => {
    // Given: ツリー構造
    await setupTestTree([
      { id: 'root', parentId: null, name: 'Root' },
      { id: 'child-1', parentId: 'root', name: 'Child 1' },
      { id: 'child-2', parentId: 'root', name: 'Child 2' },
      { id: 'grandchild-1', parentId: 'child-1', name: 'Grandchild 1' }
    ]);
    
    // When: 全子孫を取得
    const descendants = await getAllDescendants(db, 'root');
    
    // Then: 全子孫が取得される（BFS順序）
    expect(descendants).toHaveLength(3);
    expect(descendants).toEqual([
      'child-1',
      'child-2', 
      'grandchild-1'
    ]);
  });
});
```

#### TC-GAD-002: リーフノードの処理
```typescript
it('should return empty array for leaf nodes', async () => {
  await db.treeNodes.add(createTestNode('leaf', 'parent', 'Leaf'));
  
  const descendants = await getAllDescendants(db, 'leaf');
  
  expect(descendants).toEqual([]);
});
```

### 4.2 パフォーマンステスト

#### TC-GAD-P001: 大規模子孫取得
```typescript
it('should efficiently get descendants from large tree', async () => {
  // Given: 10000ノードの大規模ツリー
  await setupLargeTestTree(10000);
  
  const startTime = performance.now();
  
  // When: 全子孫取得
  const descendants = await getAllDescendants(db, 'large-root');
  
  const endTime = performance.now();
  
  // Then: パフォーマンス要件を満たす
  expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
  expect(descendants.length).toBe(9999); // root以外の全ノード
});
```

### 4.3 エラーハンドリングテスト

#### TC-GAD-E001: 存在しないノード
```typescript
it('should return empty array for non-existent node', async () => {
  const descendants = await getAllDescendants(db, 'non-existent');
  expect(descendants).toEqual([]);
});
```

## 5. 統合テスト

### 5.1 機能間連携テスト

#### TC-INT-001: 複製後のグループ化
```typescript
it('should work correctly with duplicated branches', async () => {
  // Given: 元のツリー構造
  await setupTestTree([
    { id: 'original-root', parentId: 'super-root', name: 'Original' },
    { id: 'original-child', parentId: 'original-root', name: 'Child' }
  ]);
  
  // When: 複製してからグループ化
  const idMapping = new Map();
  await duplicateBranch(db, 'original-root', 'new-parent', idMapping);
  
  const allNodes = [
    'original-root',
    'original-child', 
    idMapping.get('original-root'),
    idMapping.get('original-child')
  ];
  
  const topLevel = await groupDescendants(db, allNodes);
  
  // Then: オリジナルとコピーの両方のルートが取得される
  expect(topLevel).toHaveLength(2);
});
```

## 6. テストデータセットアップ

### 6.1 共通ヘルパー関数

```typescript
// テストデータ作成ヘルパー
function createTestNode(id: string, parentId: string | null, name: string): TreeNode {
  return {
    treeNodeId: id as TreeNodeId,
    parentTreeNodeId: parentId as TreeNodeId,
    name,
    treeNodeType: 'folder',
    createdAt: Date.now() as Timestamp,
    updatedAt: Date.now() as Timestamp,
    version: 1
  };
}

// ツリー構造セットアップ
async function setupTestTree(nodes: Array<{id: string, parentId: string | null, name: string}>) {
  const treeNodes = nodes.map(node => createTestNode(node.id, node.parentId, node.name));
  await db.treeNodes.bulkAdd(treeNodes);
}

// 大規模ツリーセットアップ
async function setupLargeTestTree(nodeCount: number) {
  const nodes: TreeNode[] = [];
  
  // ルートノード作成
  nodes.push(createTestNode('large-root', null, 'Large Root'));
  
  // バランスの取れたツリー構造を生成
  for (let i = 1; i < nodeCount; i++) {
    const parentId = i === 1 ? 'large-root' : `node-${Math.floor((i - 1) / 10)}`;
    nodes.push(createTestNode(`node-${i}`, parentId, `Node ${i}`));
  }
  
  await db.treeNodes.bulkAdd(nodes);
}
```

## 7. テスト実行計画

### 7.1 TDD実装順序

1. **Phase 1**: duplicateBranch基本機能
   - TC-DB-001 (単一ノード複製)
   - TC-DB-002 (小規模ブランチ複製)

2. **Phase 2**: duplicateBranchエラーハンドリング  
   - TC-DB-E001, TC-DB-E002 (存在しないノードエラー)

3. **Phase 3**: groupDescendants基本機能
   - TC-GD-001 (基本グループ化)

4. **Phase 4**: getAllDescendants基本機能
   - TC-GAD-001 (基本子孫取得)

5. **Phase 5**: パフォーマンス・統合テスト
   - TC-DB-P001, TC-GAD-P001 (性能テスト)
   - TC-INT-001 (統合テスト)

### 7.2 成功基準

- **テストカバレッジ**: 90%以上
- **全テストパス**: 100%成功率
- **パフォーマンス**: 全性能要件クリア
- **エラーハンドリング**: 全エラーケース適切処理