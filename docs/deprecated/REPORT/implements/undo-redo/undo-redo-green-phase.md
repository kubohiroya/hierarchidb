# Undo/Redo機能 - Greenフェーズ実装記録

## 実装概要

TDDのGreenフェーズとして、Undo/Redo機能の最小限の実装を完了しました。テスト要件を満たすための基本的なUndo/Redo動作を実現しています。

## 実装した機能

### 1. コマンド記録システムの修正

**実装箇所**: `packages/worker/src/WorkerAPIImpl.ts`

```typescript
/**
 * 【機能概要】: フォルダ作成のOrchestrated API - Command記録を含む完全なフォルダ作成処理
 * 【実装方針】: テストを通すためにCommandProcessorにコマンドを記録する最小限の実装
 * 【テスト対応】: Undo/Redoテストで期待されるコマンド履歴の記録を実現
 * 🟢 信頼性レベル: 元資料（分析文書）の実装方針に基づいた実装
 */
async createFolder(params: {
  treeId: string;
  parentNodeId: TreeNodeId;
  name: string;
  description?: string;
}): Promise<{ success: boolean; nodeId?: TreeNodeId; error?: string }> {
  // ... 実装内容
  
  // 【CommandProcessor記録】: Undo/Redoのためにコマンドをスタックに記録 🟢
  const folderCreateCommand = {
    payload: {
      nodeId: nodeId,
      parentNodeId: params.parentNodeId,
      name: params.name,
      description: params.description,
    },
    commandId: `folder-create-${Date.now()}`,
    groupId: groupId,
    kind: 'createFolder' as const,
    issuedAt: Date.now(),
  };

  // 【コマンド記録実行】: CommandProcessorにフォルダ作成コマンドを記録
  await this.commandProcessor.processCommand(folderCreateCommand);
}
```

**修正内容**:
- フォルダ作成後にCommandProcessorへの記録処理を追加
- `createFolder`専用のコマンド種別でコマンドを記録
- グループIDを統一してコマンドを関連付け

### 2. CommandProcessor のUndo/Redo判定拡張

**実装箇所**: `packages/worker/src/command/CommandProcessor.ts`

```typescript
/**
 * 【機能概要】: コマンドがUndo可能かどうかを判定する
 * 【実装方針】: テストを通すためにcreateFolder含むフォルダ操作コマンドを追加
 * 🟢 信頼性レベル: 元資料のコマンド種別に基づいた判定
 */
private isUndoableCommand(type: string): boolean {
  const undoableCommands = [
    'createNode', 
    'updateNode', 
    'deleteNode', 
    'moveNode',
    'createFolder', // 【フォルダ作成】: テスト要件対応のため追加
    'moveFolder',   // 【フォルダ移動】: 将来対応のため追加
    'updateFolder', // 【フォルダ更新】: 将来対応のため追加
    'commitWorkingCopyForCreate', // 【Working Copy コミット】: 実際の作成処理
  ];
  return undoableCommands.includes(type);
}
```

### 3. 実際のUndo/Redo操作の実装

**Undo実装**:
```typescript
/**
 * 【機能概要】: 最後のコマンドをUndo（元に戻す）する
 * 【実装方針】: テストを通すための最小限のUndo実装
 * 🟢 信頼性レベル: 元資料の分析に基づいた逆操作実装
 */
async undo(): Promise<CommandResult> {
  const command = this.undoStack.pop();
  if (!command) {
    return this.createErrorResult('No command to undo', WorkerErrorCode.INVALID_OPERATION);
  }

  try {
    // 【逆操作実行】: コマンドの逆操作を実行してデータを元の状態に戻す 🟢
    await this.executeReverseCommand(command);
    
    // 【Redoスタック追加】: Undo成功後はRedoスタックに移動 🟢
    this.redoStack.push(command);

    return { success: true, seq: this.getNextSeq() };
  } catch (error) {
    this.undoStack.push(command); // 失敗時はロールバック
    return this.createErrorResult(/*...*/);
  }
}
```

**Redo実装**:
```typescript
/**
 * 【機能概要】: Undoした操作をRedo（やり直し）する
 * 🟢 信頼性レベル: 元資料の分析に基づいた再実行実装
 */
async redo(): Promise<CommandResult> {
  const command = this.redoStack.pop();
  if (!command) {
    return this.createErrorResult('No command to redo', WorkerErrorCode.INVALID_OPERATION);
  }

  try {
    // 【コマンド再実行】: Undoで取り消されたコマンドを再実行 🟢
    await this.executeRedoCommand(command);
    
    // 【Undoスタック追加】: Redo成功後はUndoスタックに戻す 🟢
    this.undoStack.push(command);

    return { success: true, seq: this.getNextSeq() };
  } catch (error) {
    this.redoStack.push(command); // 失敗時はロールバック
    return this.createErrorResult(/*...*/);
  }
}
```

### 4. 具体的な逆操作・再実行ロジック

**フォルダ作成の逆操作（削除）**:
```typescript
private async executeReverseCommand<TType extends string, TPayload>(
  command: CommandEnvelope<TType, TPayload>
): Promise<void> {
  switch (command.kind) {
    case 'createFolder': {
      const payload = command.payload as any;
      const nodeId = payload.nodeId;
      
      // 【ノード削除実行】: CoreDBから作成されたノードを削除
      if (this.coreDB) {
        await this.coreDB.deleteNode(nodeId);
      } else {
        throw new Error('CoreDB reference not available - dependency injection needed');
      }
      break;
    }
    // ...
  }
}
```

**フォルダ作成の再実行（復元）**:
```typescript
private async executeRedoCommand<TType extends string, TPayload>(
  command: CommandEnvelope<TType, TPayload>
): Promise<void> {
  switch (command.kind) {
    case 'createFolder': {
      const payload = command.payload as any;
      
      if (this.coreDB) {
        const node = {
          treeNodeId: payload.nodeId,
          parentTreeNodeId: payload.parentNodeId,
          treeNodeType: 'folder',
          name: payload.name,
          description: payload.description,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
        await this.coreDB.createNode(node);
      } else {
        throw new Error('CoreDB reference not available - dependency injection needed');
      }
      break;
    }
    // ...
  }
}
```

### 5. 依存性注入の実装

**CommandProcessorへのCoreDB注入**:
```typescript
constructor(dbName: string) {
  this.coreDB = new CoreDB(dbName);
  this.commandProcessor = new CommandProcessor();
  
  // 【CoreDB依存性注入】: CommandProcessorでUndo/Redo実行時にCoreDBアクセスを可能にする 🟢
  this.commandProcessor.setCoreDB(this.coreDB);
}
```

## テスト結果

### ✅ 成功したテスト
- **Undo/Redo > フォルダ作成を取り消せる** - PASSED
- **Undo/Redo > 取り消した操作をやり直せる** - PASSED

### 📊 実装の信頼性評価
- 🟢 **青信号（高信頼）**: コマンド記録、Undo/Redoスタック管理、データベース操作
- 🟡 **黄信号（中信頼）**: 逆操作実装の詳細、エラーハンドリング
- 🔴 **赤信号（低信頼）**: 依存性注入の暫定実装

## 今後のRefactorフェーズでの改善点

### 1. 依存性注入の改善（🔴 → 🟢）
- 現在の`setCoreDB(coreDB: any)`を適切なインターフェースベースの注入に変更
- CommandProcessorのコンストラクタで依存関係を明示

### 2. エラーハンドリングの拡充（🟡 → 🟢）
- より具体的なエラータイプとメッセージの実装
- 部分的失敗時の詳細な状態管理

### 3. コマンドグループ化の実装（🔴 → 🟢）
- 複数ステップのコマンドを1つのUndo単位として扱う機能
- トランザクション的な操作のサポート

### 4. パフォーマンス最適化（🟡 → 🟢）
- Undo/Redoスタックのサイズ制限とメモリ管理
- 大量のコマンド履歴に対する効率的な処理

## 技術的な学び

### Command Patternの実装
- コマンドオブジェクトによる操作の抽象化
- Undoableコマンドの判定ロジック
- 逆操作とコマンド再実行の実装

### テスト駆動開発の効果
- 最小限の実装でテストを通す重要性
- 段階的な機能拡張の方針
- リファクタリングに向けた課題の明確化

この実装により、HierarchiDBのUndo/Redo機能の基礎が完成し、次のRefactorフェーズでより堅牢で拡張性の高いシステムへと発展させる準備が整いました。