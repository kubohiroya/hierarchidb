# Task 3: Commandパターン基盤実装 - 要件定義

## 目的
Worker API用のCommandパターン基盤を実装し、Undo/Redo機能をサポートする構造化されたコマンド処理システムを構築する。

## 要件

### 機能要件 🟢
1. **CommandEnvelope構造**
   - type: コマンドタイプ識別子
   - payload: コマンド固有のデータ
   - meta: コマンドメタデータ（commandId, timestamp, userId等）

2. **CommandResult構造**
   - 成功/失敗を明確に区別する判別共用体
   - エラーコードとメッセージを含む
   - 処理結果のシーケンス番号を含む

3. **CommandProcessor**
   - コマンドの実行処理
   - Undo/Redoバッファへの記録
   - エラーハンドリング

4. **ErrorCode定義**
   - 標準的なエラーコード一覧
   - カテゴリ別の分類

### 非機能要件 🟢
1. **型安全性**: TypeScriptのジェネリクスを活用した型安全な実装
2. **拡張性**: 新しいコマンドタイプを容易に追加可能
3. **パフォーマンス**: コマンド処理は100ms以内

## 受け入れ基準

### 必須条件
- [ ] CommandEnvelopeインターフェースが定義されている
- [ ] CommandResultの判別共用体が実装されている
- [ ] ErrorCodeの列挙型が定義されている
- [ ] CommandProcessorクラスの基本構造が実装されている
- [ ] 型安全性が保証されている

### テスト条件
- [ ] 正常なコマンド処理のテスト
- [ ] エラーハンドリングのテスト
- [ ] 型チェックのテスト
- [ ] メタデータの自動付与テスト

## 実装詳細仕様

### CommandEnvelope
```typescript
interface CommandEnvelope<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
  meta: CommandMeta;
}

interface CommandMeta {
  commandId: UUID;
  timestamp: Timestamp;
  userId?: string;
  correlationId?: UUID;
}
```

### CommandResult
```typescript
type CommandResult = 
  | { success: true; seq: Seq; nodeId?: TreeNodeId; newNodeIds?: TreeNodeId[] }
  | { success: false; error: string; code: ErrorCode; seq?: Seq };
```

### ErrorCode
```typescript
enum ErrorCode {
  // 一般エラー
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // ノード操作エラー
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  PARENT_NOT_FOUND = 'PARENT_NOT_FOUND',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  
  // Working Copyエラー
  WORKING_COPY_NOT_FOUND = 'WORKING_COPY_NOT_FOUND',
  WORKING_COPY_ALREADY_EXISTS = 'WORKING_COPY_ALREADY_EXISTS',
  COMMIT_CONFLICT = 'COMMIT_CONFLICT',
  
  // 権限エラー
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // データベースエラー
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED'
}
```

## 依存関係
- @hierarchidb/core の型定義
- UUID生成ユーティリティ
- Timestamp生成ユーティリティ