# Task 3: Commandパターン基盤実装 - テストケース

## テストケース一覧

### 1. CommandEnvelope構造テスト

#### TC-3-1: CommandEnvelopeの基本構造
```typescript
it('should create a valid CommandEnvelope', () => {
  const envelope: CommandEnvelope<'testCommand', { data: string }> = {
    type: 'testCommand',
    payload: { data: 'test' },
    meta: {
      commandId: generateUUID(),
      timestamp: Date.now(),
      userId: 'user123'
    }
  };
  
  expect(envelope.type).toBe('testCommand');
  expect(envelope.payload.data).toBe('test');
  expect(envelope.meta.commandId).toBeDefined();
});
```

#### TC-3-2: CommandMetaの自動生成
```typescript
it('should auto-generate command meta if not provided', () => {
  const processor = new CommandProcessor();
  const envelope = processor.createEnvelope('testCommand', { data: 'test' });
  
  expect(envelope.meta.commandId).toBeDefined();
  expect(envelope.meta.timestamp).toBeCloseTo(Date.now(), -2);
});
```

### 2. CommandResult判別共用体テスト

#### TC-3-3: 成功結果の構造
```typescript
it('should create success result', () => {
  const result: CommandResult = {
    success: true,
    seq: 1 as Seq,
    nodeId: 'node-123' as TreeNodeId
  };
  
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.seq).toBe(1);
    expect(result.nodeId).toBe('node-123');
  }
});
```

#### TC-3-4: 失敗結果の構造
```typescript
it('should create failure result', () => {
  const result: CommandResult = {
    success: false,
    error: 'Node not found',
    code: ErrorCode.NODE_NOT_FOUND
  };
  
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe('Node not found');
    expect(result.code).toBe(ErrorCode.NODE_NOT_FOUND);
  }
});
```

### 3. ErrorCode列挙型テスト

#### TC-3-5: ErrorCode定義の完全性
```typescript
it('should have all required error codes', () => {
  expect(ErrorCode.UNKNOWN_ERROR).toBeDefined();
  expect(ErrorCode.NODE_NOT_FOUND).toBeDefined();
  expect(ErrorCode.WORKING_COPY_NOT_FOUND).toBeDefined();
  expect(ErrorCode.COMMIT_CONFLICT).toBeDefined();
  expect(ErrorCode.DATABASE_ERROR).toBeDefined();
});
```

### 4. CommandProcessorテスト

#### TC-3-6: コマンド処理の成功
```typescript
it('should process command successfully', async () => {
  const processor = new CommandProcessor();
  const envelope: CommandEnvelope<'createNode', { name: string }> = {
    type: 'createNode',
    payload: { name: 'New Node' },
    meta: {
      commandId: generateUUID(),
      timestamp: Date.now()
    }
  };
  
  const result = await processor.processCommand(envelope);
  
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.seq).toBeDefined();
  }
});
```

#### TC-3-7: エラーハンドリング
```typescript
it('should handle errors properly', async () => {
  const processor = new CommandProcessor();
  const envelope: CommandEnvelope<'invalidCommand', {}> = {
    type: 'invalidCommand',
    payload: {},
    meta: {
      commandId: generateUUID(),
      timestamp: Date.now()
    }
  };
  
  const result = await processor.processCommand(envelope);
  
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBeDefined();
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
  }
});
```

#### TC-3-8: Undo/Redoバッファへの記録
```typescript
it('should record command in undo buffer', async () => {
  const processor = new CommandProcessor();
  const envelope: CommandEnvelope<'updateNode', { id: string; name: string }> = {
    type: 'updateNode',
    payload: { id: 'node-1', name: 'Updated' },
    meta: {
      commandId: generateUUID(),
      timestamp: Date.now()
    }
  };
  
  await processor.processCommand(envelope);
  
  expect(processor.canUndo()).toBe(true);
  expect(processor.getUndoStackSize()).toBe(1);
});
```

### 5. 型安全性テスト

#### TC-3-9: ジェネリック型の推論
```typescript
it('should infer types correctly', () => {
  type TestPayload = { value: number };
  const envelope: CommandEnvelope<'test', TestPayload> = {
    type: 'test',
    payload: { value: 42 },
    meta: {
      commandId: generateUUID(),
      timestamp: Date.now()
    }
  };
  
  // TypeScript compiler should enforce this
  expect(envelope.payload.value).toBeTypeOf('number');
});
```

### 6. エッジケーステスト

#### TC-3-10: 空のペイロード
```typescript
it('should handle empty payload', async () => {
  const processor = new CommandProcessor();
  const envelope: CommandEnvelope<'ping', {}> = {
    type: 'ping',
    payload: {},
    meta: {
      commandId: generateUUID(),
      timestamp: Date.now()
    }
  };
  
  const result = await processor.processCommand(envelope);
  expect(result).toBeDefined();
});
```

#### TC-3-11: 大きなペイロード
```typescript
it('should handle large payload', async () => {
  const processor = new CommandProcessor();
  const largeData = Array(1000).fill({ data: 'test' });
  const envelope: CommandEnvelope<'bulkCreate', { items: any[] }> = {
    type: 'bulkCreate',
    payload: { items: largeData },
    meta: {
      commandId: generateUUID(),
      timestamp: Date.now()
    }
  };
  
  const startTime = performance.now();
  const result = await processor.processCommand(envelope);
  const duration = performance.now() - startTime;
  
  expect(duration).toBeLessThan(100); // 100ms以内
});
```

#### TC-3-12: correlationIdの伝播
```typescript
it('should propagate correlationId', async () => {
  const processor = new CommandProcessor();
  const correlationId = generateUUID();
  const envelope: CommandEnvelope<'test', {}> = {
    type: 'test',
    payload: {},
    meta: {
      commandId: generateUUID(),
      timestamp: Date.now(),
      correlationId
    }
  };
  
  await processor.processCommand(envelope);
  
  // correlationIdが関連するイベントに伝播されることを確認
  const lastEvent = processor.getLastEvent();
  expect(lastEvent?.correlationId).toBe(correlationId);
});
```

## テスト実行順序
1. 基本構造テスト (TC-3-1 〜 TC-3-5)
2. 処理フローテスト (TC-3-6 〜 TC-3-8)
3. 型安全性テスト (TC-3-9)
4. エッジケーステスト (TC-3-10 〜 TC-3-12)

## カバレッジ目標
- ステートメントカバレッジ: 90%以上
- ブランチカバレッジ: 85%以上
- 関数カバレッジ: 100%