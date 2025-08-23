# Undo/Redo操作の問題分析と実装方針

## 現在の問題

### テスト失敗の詳細
```
FAIL > Undo/Redo > フォルダ作成を取り消せる
AssertionError: expected false to be true
❯ expect(undoResult.success).toBe(true);

FAIL > Undo/Redo > 取り消した操作をやり直せる
AssertionError: expected false to be true  
❯ expect(redoResult.success).toBe(true);
```

### 症状
1. `api.undoFolder()` が失敗を返す（`success: false`）
2. `api.redoFolder()` が失敗を返す（`success: false`）
3. CommandProcessorとOrchestrated APIの連携に問題がある

## 現状で試行した対処

### 1. Orchestrated API実装
実装されたOrchestrated API:
```typescript
// Undo操作
async undoFolder(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await this.undo({
      payload: {},
      commandId: `undo-${Date.now()}`,
      groupId: `group-${Date.now()}`,
      kind: 'undo',
      issuedAt: Date.now(),
    });
    
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Redo操作  
async redoFolder(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await this.redo({
      payload: {},
      commandId: `redo-${Date.now()}`,
      groupId: `group-${Date.now()}`,
      kind: 'redo', 
      issuedAt: Date.now(),
    });
    
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### 2. WorkerAPIImpl内のUndo/Redo実装
```typescript
async undo(cmd: CommandEnvelope<'undo', UndoPayload>): Promise<CoreCommandResult> {
  // Use CommandProcessor for undo
  const result = await this.commandProcessor.undo();
  return this.convertToCommandResult(result);
}

async redo(cmd: CommandEnvelope<'redo', RedoPayload>): Promise<CoreCommandResult> {
  // Use CommandProcessor for redo
  const result = await this.commandProcessor.redo();
  return this.convertToCommandResult(result);
}
```

## 根本原因分析

### 1. CommandProcessorの状態管理問題
現在のアーキテクチャでは以下の問題がある：

#### 1.1 Command記録の不整合
- Orchestrated API（`createFolder`）は直接CoreDBを操作する
- CommandProcessorにコマンドが記録されない
- Undo/Redoスタックが空のまま

#### 1.2 Command Envelope vs Orchestrated APIの分離
```typescript
// Orchestrated API（記録されない）
await api.createFolder({ ... }); // CommandProcessorに記録されない

// vs Command Envelope（記録される） 
await api.commitWorkingCopyForCreate({ ... }); // CommandProcessorに記録される
```

### 2. UndoPayloadの仕様問題
```typescript
// 現在の実装
payload: {} // 空のペイロード

// 実際の仕様（推定）
export interface UndoPayload {
  groupId: CommandGroupId; // 必須プロパティが不足
}
```

### 3. CommandProcessorの初期化問題
- CommandProcessorが適切に初期化されていない可能性
- Undo/Redoスタックの状態確認が必要

## 今後の実装方針

### Phase 1: Command記録システムの修正

#### 1.1 Orchestrated APIでのCommand記録
```typescript
async createFolder(params: {
  treeId: string;
  parentNodeId: TreeNodeId;
  name: string;
  description?: string;
}): Promise<{ success: boolean; nodeId?: TreeNodeId; error?: string }> {
  try {
    // バリデーション...
    
    const workingCopyId = `wc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Working Copy作成のCommand Envelope
    const createCmd: CommandEnvelope<'createWorkingCopyForCreate', CreateWorkingCopyForCreatePayload> = {
      payload: {
        workingCopyId,
        parentTreeNodeId: params.parentNodeId,
        name: params.name,
        description: params.description,
      },
      commandId: `create-${Date.now()}`,
      groupId: `group-${Date.now()}`,
      kind: 'createWorkingCopyForCreate',
      issuedAt: Date.now(),
    };
    
    // CommandProcessorに記録
    await this.commandProcessor.processCommand(createCmd);
    await this.createWorkingCopyForCreate(createCmd);
    
    // コミットのCommand Envelope
    const commitCmd: CommandEnvelope<'commitWorkingCopyForCreate', CommitWorkingCopyForCreatePayload> = {
      payload: { workingCopyId },
      commandId: `commit-${Date.now()}`,
      groupId: createCmd.groupId, // 同じグループIDを使用
      kind: 'commitWorkingCopyForCreate',
      issuedAt: Date.now(),
    };
    
    // CommandProcessorに記録
    await this.commandProcessor.processCommand(commitCmd);
    const commitResult = await this.commitWorkingCopyForCreate(commitCmd);
    
    if (commitResult.success) {
      return {
        success: true,
        nodeId: (commitResult as any).nodeId,
      };
    } else {
      return {
        success: false,
        error: commitResult.error,
      };
    }
    
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}
```

#### 1.2 CommandProcessorの拡張
```typescript
export class CommandProcessor {
  private undoStack: CommandEnvelope<any, any>[] = [];
  private redoStack: CommandEnvelope<any, any>[] = [];
  private maxStackSize = 100;
  
  async processCommand<K extends string, P>(
    cmd: CommandEnvelope<K, P>
  ): Promise<CommandResult> {
    // コマンドをundoスタックに追加
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    
    // redoスタックをクリア（新しい操作後）
    this.redoStack = [];
    
    return {
      success: true,
      seq: this.getNextSeq(),
    };
  }
  
  async undo(): Promise<CommandResult> {
    if (this.undoStack.length === 0) {
      return {
        success: false,
        error: 'Nothing to undo',
        code: 'INVALID_OPERATION',
      };
    }
    
    const lastCommand = this.undoStack.pop()!;
    
    try {
      // 逆操作を実行
      await this.executeReverseCommand(lastCommand);
      
      // redoスタックに移動
      this.redoStack.push(lastCommand);
      
      return {
        success: true,
        seq: this.getNextSeq(),
      };
    } catch (error) {
      // 失敗時は元に戻す
      this.undoStack.push(lastCommand);
      return {
        success: false,
        error: String(error),
        code: 'INTERNAL_ERROR',
      };
    }
  }
  
  async redo(): Promise<CommandResult> {
    if (this.redoStack.length === 0) {
      return {
        success: false,
        error: 'Nothing to redo',
        code: 'INVALID_OPERATION',
      };
    }
    
    const commandToRedo = this.redoStack.pop()!;
    
    try {
      // コマンドを再実行
      await this.executeCommand(commandToRedo);
      
      // undoスタックに戻す
      this.undoStack.push(commandToRedo);
      
      return {
        success: true,
        seq: this.getNextSeq(),
      };
    } catch (error) {
      // 失敗時は元に戻す
      this.redoStack.push(commandToRedo);
      return {
        success: false,
        error: String(error),
        code: 'INTERNAL_ERROR',
      };
    }
  }
  
  private async executeReverseCommand<K extends string, P>(
    cmd: CommandEnvelope<K, P>
  ): Promise<void> {
    switch (cmd.kind) {
      case 'commitWorkingCopyForCreate':
        // 作成されたノードを削除
        const createPayload = cmd.payload as CommitWorkingCopyForCreatePayload;
        // ノードIDを特定して削除する逆操作
        await this.deleteCreatedNode(createPayload.workingCopyId);
        break;
        
      case 'moveNodes':
        // ノードを元の位置に戻す
        const movePayload = cmd.payload as MoveNodesPayload;
        // 元の親IDを特定して戻す逆操作
        await this.restoreNodePositions(movePayload);
        break;
        
      // その他のコマンドタイプの逆操作...
      default:
        throw new Error(`Reverse operation not implemented for: ${cmd.kind}`);
    }
  }
}
```

### Phase 2: UndoPayload仕様の修正

#### 2.1 正しいPayload構造
```typescript
async undoFolder(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await this.undo({
      payload: {
        groupId: '', // 特定のグループIDがある場合
      } as UndoPayload,
      commandId: `undo-${Date.now()}`,
      groupId: `group-${Date.now()}`,
      kind: 'undo',
      issuedAt: Date.now(),
    });
    
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### Phase 3: 高度な機能実装

#### 3.1 グループ化された操作のUndo/Redo
```typescript
// 複数のコマンドを1つの操作として扱う
async executeCommandGroup(commands: CommandEnvelope<any, any>[]): Promise<CommandResult> {
  const groupId = `group-${Date.now()}`;
  const results: CommandResult[] = [];
  
  try {
    for (const cmd of commands) {
      cmd.groupId = groupId;
      const result = await this.processCommand(cmd);
      results.push(result);
    }
    
    return { success: true, seq: this.getNextSeq() };
  } catch (error) {
    // 部分的な成功の場合のロールバック処理
    await this.rollbackGroup(groupId);
    return { success: false, error: String(error), code: 'INTERNAL_ERROR' };
  }
}
```

#### 3.2 永続化対応
```typescript
// CommandProcessorの状態をEphemeralDBに保存
export class PersistentCommandProcessor extends CommandProcessor {
  async saveState(): Promise<void> {
    await this.ephemeralDB.commandHistory.clear();
    await this.ephemeralDB.commandHistory.bulkAdd([
      { type: 'undo', commands: this.undoStack },
      { type: 'redo', commands: this.redoStack },
    ]);
  }
  
  async loadState(): Promise<void> {
    const history = await this.ephemeralDB.commandHistory.toArray();
    // 状態を復元...
  }
}
```

## 検証方法

### 単体テスト
```typescript
describe('CommandProcessor', () => {
  it('processCommand はコマンドをundoスタックに追加する', async () => {
    const cmd = createTestCommand();
    await processor.processCommand(cmd);
    
    expect(processor.canUndo()).toBe(true);
    expect(processor.getUndoStackSize()).toBe(1);
  });
  
  it('undo は最後のコマンドを取り消す', async () => {
    const node = await createTestNode();
    const deleteCmd = createDeleteCommand(node.id);
    
    await processor.processCommand(deleteCmd);
    expect(await getNode(node.id)).toBeUndefined();
    
    await processor.undo();
    expect(await getNode(node.id)).toBeDefined();
  });
});
```

### 統合テスト
```typescript
describe('Undo/Redo統合テスト', () => {
  it('Orchestrated API で作成したフォルダをUndoできる', async () => {
    const result = await api.createFolder({
      treeId: testTreeId,
      parentNodeId: 'root',
      name: 'Test Folder',
    });
    
    expect(result.success).toBe(true);
    const nodeId = result.nodeId!;
    
    const undoResult = await api.undoFolder();
    expect(undoResult.success).toBe(true);
    
    const node = await api.getNode({ treeNodeId: nodeId });
    expect(node).toBeUndefined();
  });
});
```

## 優先度

### 高優先度
1. CommandProcessorでのCommand記録機能の実装
2. Orchestrated APIとCommandProcessorの連携修正
3. 基本的なUndo/Redo操作の実装

### 中優先度
1. グループ化されたコマンドのUndo/Redo
2. コマンドの逆操作実装の拡充
3. エラー時のロールバック処理

### 低優先度
1. CommandProcessorの永続化
2. UI統合（Undo/Redoボタンの状態管理）
3. キーボードショートカット対応

## 備考

Undo/Redo機能は統合テストアーキテクチャの高度な機能であり、Command PatternとOrchestrated APIの橋渡しとして重要な役割を果たす。適切な実装により、ユーザビリティの大幅な向上とデータ操作の安全性確保が実現される。