# ゴミ箱操作の問題分析と実装方針

## 現在の問題

### テスト失敗の詳細
```
FAIL > ゴミ箱操作 > フォルダをゴミ箱に移動できる
AssertionError: expected undefined to be true
❯ expect(node?.isRemoved).toBe(true);

FAIL > ゴミ箱操作 > ゴミ箱から復元できる  
AssertionError: expected undefined to be false
❯ expect(node?.isRemoved).toBe(false);
```

### 症状
1. `api.moveToTrashFolder()` API呼び出しは成功を返す（`success: true`）
2. しかし実際のノードには `isRemoved` プロパティが設定されない（`undefined`）
3. ゴミ箱操作後もノードの状態が変更されていない

## 現状で試行した対処

### 1. プロパティ名の修正
- 初期：`node?.isDeleted` を期待
- 修正：ユーザー指摘により `node?.isRemoved` に変更
- 結果：依然として `undefined`

### 2. Orchestrated API実装確認
実装されたOrchestrated API:
```typescript
async moveToTrashFolder(params: {
  nodeIds: TreeNodeId[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await this.moveToTrash({
      payload: { nodeIds: params.nodeIds },
      commandId: `trash-${Date.now()}`,
      groupId: `group-${Date.now()}`,
      kind: 'moveToTrash',
      issuedAt: Date.now(),
    });
    
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

## 根本原因分析

### 1. Command Envelopeの実装不完全
現在のOrchestrated APIは `this.moveToTrash()` を呼び出すが、これは古いCommand Envelopeパターンを使用している。しかし、実際の `TreeMutationServiceImpl.moveToTrash()` 実装が不完全または未実装の可能性がある。

### 2. TreeNodeスキーマの不整合
- テストは `isRemoved` プロパティを期待
- 実際のTreeNodeエンティティにこのプロパティが定義されていない可能性
- または、ゴミ箱操作でこのプロパティが設定されていない

### 3. データベース更新の失敗
- Command Envelopeが成功を返すが、実際のデータベース更新が行われていない
- トランザクションのコミット失敗
- CoreDBの `updateNode()` 呼び出しが行われていない

## 技術的調査結果

### TreeNodeエンティティ確認必要
```typescript
// packages/core/src/types/base.ts で確認が必要
interface TreeNode {
  treeNodeId: TreeNodeId;
  parentTreeNodeId: TreeNodeId;
  treeNodeType: TreeNodeType;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
  isRemoved?: boolean; // この定義が存在するか？
  removedAt?: Timestamp; // ゴミ箱移動時刻
  // その他のプロパティ...
}
```

### TreeMutationServiceImpl.moveToTrash実装確認必要
現在の実装が以下を行っているか確認：
1. ノードの `isRemoved: true` 設定
2. `removedAt` タイムスタンプ設定  
3. 必要に応じて `parentTreeNodeId` の変更（ゴミ箱ルートへの移動）
4. CoreDBへの変更のコミット

## 今後の実装方針

### Phase 1: 基本ゴミ箱機能の実装

#### 1.1 TreeNodeスキーマ拡張
```typescript
interface TreeNode {
  // 既存プロパティ...
  isRemoved?: boolean;        // ゴミ箱フラグ
  removedAt?: Timestamp;      // ゴミ箱移動時刻
  originalParentId?: TreeNodeId; // 復元用の元親ID
}
```

#### 1.2 TreeMutationServiceImpl.moveToTrash完全実装
```typescript
async moveToTrash(
  cmd: CommandEnvelope<'moveToTrash', MoveToTrashPayload>
): Promise<CoreCommandResult> {
  const { nodeIds } = cmd.payload;
  
  try {
    for (const nodeId of nodeIds) {
      const node = await this.coreDB.getNode(nodeId);
      if (!node) continue;
      
      // ゴミ箱状態に更新
      const updatedNode: TreeNode = {
        ...node,
        isRemoved: true,
        removedAt: Date.now(),
        originalParentId: node.parentTreeNodeId,
        // 必要に応じてtrashRootに移動
        // parentTreeNodeId: this.getTrashRootId(),
        updatedAt: Date.now(),
        version: node.version + 1,
      };
      
      await this.coreDB.updateNode(updatedNode);
    }
    
    return { success: true, seq: this.getNextSeq() };
  } catch (error) {
    return { 
      success: false, 
      error: String(error),
      code: 'INTERNAL_ERROR' 
    };
  }
}
```

#### 1.3 復元機能の実装
```typescript
async recoverFromTrash(
  cmd: CommandEnvelope<'recoverFromTrash', RecoverFromTrashPayload>  
): Promise<CoreCommandResult> {
  const { nodeIds, toParentId } = cmd.payload;
  
  for (const nodeId of nodeIds) {
    const node = await this.coreDB.getNode(nodeId);
    if (!node || !node.isRemoved) continue;
    
    const updatedNode: TreeNode = {
      ...node,
      isRemoved: false,
      removedAt: undefined,
      parentTreeNodeId: toParentId || node.originalParentId,
      originalParentId: undefined,
      updatedAt: Date.now(),
      version: node.version + 1,
    };
    
    await this.coreDB.updateNode(updatedNode);
  }
}
```

### Phase 2: 高度な機能

#### 2.1 ゴミ箱ルート管理
- 専用のゴミ箱ルートノードへの物理移動
- ゴミ箱内での階層構造保持

#### 2.2 自動削除機能  
- 一定期間後の自動永続削除
- バックグラウンドクリーンアップタスク

#### 2.3 一括操作の最適化
- トランザクション使用による整合性保証
- 大量削除時のパフォーマンス最適化

### Phase 3: UI統合

#### 3.1 ゴミ箱ビューの実装
- 削除されたアイテムの表示
- 復元・永続削除の操作UI

#### 3.2 削除確認ダイアログ
- ユーザーの意図確認
- 復元可能性の説明

## 優先度と実装順序

### 高優先度（統合テスト修正のため）
1. TreeNodeスキーマの `isRemoved` プロパティ確認・追加
2. TreeMutationServiceImpl.moveToTrash の基本実装
3. CoreDB.updateNode による状態更新の確認

### 中優先度（機能完成のため）
1. 復元機能の実装
2. 永続削除機能の実装  
3. エラーハンドリングの強化

### 低優先度（UX向上のため）
1. ゴミ箱ルートへの物理移動
2. 自動削除機能
3. UI統合

## 検証方法

### 単体テスト
```typescript
it('moveToTrashは isRemoved フラグを設定する', async () => {
  const node = await createTestNode();
  
  await mutationService.moveToTrash({
    payload: { nodeIds: [node.treeNodeId] },
    // ... command envelope
  });
  
  const updatedNode = await coreDB.getNode(node.treeNodeId);
  expect(updatedNode?.isRemoved).toBe(true);
  expect(updatedNode?.removedAt).toBeDefined();
});
```

### 統合テスト
既存の `folder-operations.test.ts` のゴミ箱テストが合格することを確認。

## 備考

この実装により、統合テストアーキテクチャの完全な実証が可能となり、React非依存でのWorker層直接テストの有効性が証明される。ゴミ箱機能は階層データベースシステムの重要な機能であり、適切な実装により堅牢なデータ管理が実現される。