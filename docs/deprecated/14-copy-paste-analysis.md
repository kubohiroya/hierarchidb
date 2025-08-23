# Copy&Paste操作の問題分析と実装方針

## 現在の問題

### テスト失敗の詳細
```
FAIL > 複製とコピー > フォルダをコピー&ペーストできる
AssertionError: expected false to be true
❯ expect(pasteResult.success).toBe(true);
```

### 症状
1. `api.copyNodesFolder()` は成功を返す（`success: true`）
2. しかし `api.pasteNodesFolder()` が失敗を返す（`success: false`）
3. クリップボードデータの受け渡しに問題がある可能性

## 現状で試行した対処

### 1. Orchestrated API実装
実装されたOrchestrated API:
```typescript
// コピー操作
async copyNodesFolder(params: {
  nodeIds: TreeNodeId[];
}): Promise<{ success: boolean; clipboardData?: any; error?: string }> {
  try {
    const result = await this.copyNodes({
      nodeIds: params.nodeIds,
    });
    
    return { 
      success: result.success, 
      clipboardData: (result as any).clipboardData,
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ペースト操作
async pasteNodesFolder(params: {
  targetParentId: TreeNodeId;
  clipboardData: any;
}): Promise<{ success: boolean; nodeIds?: TreeNodeId[]; error?: string }> {
  try {
    const result = await this.pasteNodes({
      payload: {
        nodes: params.clipboardData?.nodes,
        nodeIds: params.clipboardData?.nodeIds, 
        toParentId: params.targetParentId,
      },
      commandId: `paste-${Date.now()}`,
      groupId: `group-${Date.now()}`,
      kind: 'pasteNodes',
      issuedAt: Date.now(),
    });
    
    return { 
      success: result.success, 
      nodeIds: (result as any).newNodeIds,
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### 2. テストの実装
```typescript
// コピー（Orchestrated API使用）
const copyResult = await api.copyNodesFolder({
  nodeIds: [sourceId],
});

expect(copyResult.success).toBe(true);

// ペースト（Orchestrated API使用） 
const pasteResult = await api.pasteNodesFolder({
  targetParentId: targetParent,
  clipboardData: copyResult.clipboardData,
});

expect(pasteResult.success).toBe(true); // ここで失敗
```

## 根本原因分析

### 1. TreeQueryService.copyNodesの実装問題
`copyNodes` メソッドがクリップボードデータを正しく返していない可能性：
- `clipboardData` プロパティが未定義
- 期待される形式（`nodes`, `nodeIds`）でデータが構造化されていない

### 2. TreeMutationService.pasteNodesの実装問題  
`pasteNodes` メソッドでのペイロード処理の問題：
```typescript
// TreeMutationServiceImpl.pasteNodes で想定されるエラー
const { nodes, nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;
```
- `params.clipboardData?.nodes` が `undefined` の可能性
- `params.clipboardData?.nodeIds` が `undefined` の可能性

### 3. Command Envelopeとの不整合
Orchestrated APIがCommand Envelopeを正しく構築していない可能性がある。

## 今後の実装方針

### Phase 1: copyNodes実装の修正

#### 1.1 TreeQueryServiceImpl.copyNodes
```typescript
async copyNodes(payload: CopyNodesPayload): Promise<CoreCommandResult> {
  const { nodeIds } = payload;
  
  try {
    const clipboardNodes: Record<TreeNodeId, TreeNode> = {};
    
    for (const nodeId of nodeIds) {
      const node = await this.coreDB.getNode(nodeId);
      if (node) {
        clipboardNodes[nodeId] = node;
      }
    }
    
    const clipboardData = {
      nodes: clipboardNodes,
      nodeIds: nodeIds,
      timestamp: Date.now(),
    };
    
    return {
      success: true,
      seq: this.getNextSeq(),
      clipboardData: clipboardData, // 重要：このプロパティを返す
    } as CoreCommandResult;
    
  } catch (error) {
    return {
      success: false,
      error: String(error),
      code: 'INTERNAL_ERROR',
    } as CoreCommandResult;
  }
}
```

#### 1.2 CoreCommandResult型の拡張
```typescript
// packages/core/src/types/command.ts
export type CommandResult =
  | {
      success: true;
      seq: Seq;
      nodeId?: TreeNodeId;
      newNodeIds?: TreeNodeId[];
      clipboardData?: any; // Copy操作用
    }
  | {
      success: false;
      error: string;
      code: ErrorCode;
      seq?: Seq;
    };
```

### Phase 2: pasteNodes実装の修正

#### 2.1 TreeMutationServiceImpl.pasteNodes
```typescript
async pasteNodes(
  cmd: CommandEnvelope<'pasteNodes', PasteNodesPayload>
): Promise<CoreCommandResult> {
  const { nodes, nodeIds, toParentId, onNameConflict = 'error' } = cmd.payload;
  
  // バリデーション
  if (!nodes || !nodeIds || !toParentId) {
    return {
      success: false,
      error: 'Invalid paste payload: missing nodes, nodeIds, or toParentId',
      code: 'INVALID_OPERATION',
    } as CoreCommandResult;
  }
  
  const newNodeIds: TreeNodeId[] = [];
  
  try {
    for (const originalId of nodeIds) {
      const originalNode = nodes[originalId];
      if (!originalNode) continue;
      
      // 新しいノードIDを生成
      const newNodeId = generateUUID() as TreeNodeId;
      const now = Date.now();
      
      // 新しいノードを作成
      const newNode: TreeNode = {
        ...originalNode,
        treeNodeId: newNodeId,
        parentTreeNodeId: toParentId,
        name: await this.resolveNameConflict(originalNode.name, toParentId, onNameConflict),
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      
      await this.coreDB.createNode(newNode);
      newNodeIds.push(newNodeId);
    }
    
    return {
      success: true,
      seq: this.getNextSeq(),
      newNodeIds: newNodeIds,
    } as CoreCommandResult;
    
  } catch (error) {
    return {
      success: false,
      error: String(error), 
      code: 'INTERNAL_ERROR',
    } as CoreCommandResult;
  }
}

private async resolveNameConflict(
  name: string, 
  parentId: TreeNodeId, 
  onNameConflict: OnNameConflict
): Promise<string> {
  // 名前の重複チェックと解決ロジック
  const siblings = await this.coreDB.getChildren(parentId);
  const existingNames = siblings.map(node => node.name);
  
  if (!existingNames.includes(name)) {
    return name; // 重複なし
  }
  
  if (onNameConflict === 'error') {
    throw new Error(`Name conflict: ${name} already exists`);
  }
  
  // auto-rename の場合
  let counter = 1;
  let newName = `${name} (${counter})`;
  while (existingNames.includes(newName)) {
    counter++;
    newName = `${name} (${counter})`;
  }
  
  return newName;
}
```

### Phase 3: Orchestrated APIの改善

#### 3.1 エラーハンドリングの強化
```typescript
async copyNodesFolder(params: {
  nodeIds: TreeNodeId[];
}): Promise<{ success: boolean; clipboardData?: any; error?: string }> {
  try {
    // バリデーション
    if (!params.nodeIds || params.nodeIds.length === 0) {
      return {
        success: false,
        error: 'No nodes specified for copy operation',
      };
    }
    
    const result = await this.copyNodes({
      nodeIds: params.nodeIds,
    });
    
    if (result.success) {
      return { 
        success: true, 
        clipboardData: (result as any).clipboardData,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Copy operation failed',
      };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

#### 3.2 デバッグとテスト支援
```typescript
async pasteNodesFolder(params: {
  targetParentId: TreeNodeId;
  clipboardData: any;
}): Promise<{ success: boolean; nodeIds?: TreeNodeId[]; error?: string }> {
  try {
    // デバッグ情報
    console.log('Paste operation:', {
      targetParentId: params.targetParentId,
      clipboardData: params.clipboardData,
    });
    
    // バリデーション
    if (!params.clipboardData) {
      return {
        success: false,
        error: 'No clipboard data provided',
      };
    }
    
    if (!params.clipboardData.nodes || !params.clipboardData.nodeIds) {
      return {
        success: false, 
        error: 'Invalid clipboard data format',
      };
    }
    
    // 実際のペースト処理...
    
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

## 検証方法

### 単体テスト
```typescript
describe('Copy&Paste操作', () => {
  it('copyNodes はクリップボードデータを返す', async () => {
    const result = await queryService.copyNodes({
      nodeIds: [testNodeId],
    });
    
    expect(result.success).toBe(true);
    expect((result as any).clipboardData).toBeDefined();
    expect((result as any).clipboardData.nodes).toBeDefined();
    expect((result as any).clipboardData.nodeIds).toEqual([testNodeId]);
  });
  
  it('pasteNodes は新しいノードを作成する', async () => {
    const clipboardData = {
      nodes: { [testNodeId]: testNode },
      nodeIds: [testNodeId],
    };
    
    const result = await mutationService.pasteNodes({
      payload: {
        nodes: clipboardData.nodes,
        nodeIds: clipboardData.nodeIds,
        toParentId: targetParentId,
      },
      // command envelope...
    });
    
    expect(result.success).toBe(true);
    expect((result as any).newNodeIds).toHaveLength(1);
  });
});
```

### 統合テスト
既存の `folder-operations.test.ts` のコピー&ペーストテストが合格することを確認。

## 優先度

### 高優先度
1. TreeQueryServiceImpl.copyNodes の実装修正
2. CoreCommandResult型のclipboardDataプロパティ追加
3. TreeMutationServiceImpl.pasteNodes の基本実装

### 中優先度  
1. 名前重複の解決ロジック
2. エラーハンドリングの強化
3. 階層構造のコピー（子ノード含む）

### 低優先度
1. UI統合（クリップボード状態の管理）
2. キーボードショートカット対応
3. 大量データのコピー&ペースト最適化