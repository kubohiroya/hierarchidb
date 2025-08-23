# 第6部 共通ライブラリ (Common Libraries)

## Chapter 14: コア型システム (Core Type System) ⭐️⭐️⭐️⭐️⭐️

### 14.1 ブランデッドタイプシステム (Branded Type System) ⭐️⭐️⭐️⭐️⭐️

HierarchiDBの型安全性は、ブランデッドタイプによる厳格なID管理システムに基づいています。

```mermaid
graph TB
    subgraph "Base Types"
        string["string (primitive)"]
    end
    
    subgraph "Branded ID Types"
        NodeId["NodeId"]
        TreeId["TreeId"]
        EntityId["EntityId"]
        WorkingCopyId["WorkingCopyId"]
    end
    
    subgraph "Composite Types"
        TreeNode["TreeNode"]
        Entity["Entity"]
        WorkingCopy["WorkingCopy"]
    end
    
    subgraph "Utility Types"
        Result["Result<T, E>"]
        Maybe["Maybe<T>"]
        Brand["Brand<T, U>"]
    end
    
    string --> NodeId
    string --> TreeId
    string --> EntityId
    string --> WorkingCopyId
    
    NodeId --> TreeNode
    TreeId --> TreeNode
    EntityId --> Entity
    WorkingCopyId --> WorkingCopy
    
    TreeNode --> Result
    Entity --> Maybe
    WorkingCopy --> Brand
    
    classDef base fill:#e1f5fe
    classDef branded fill:#f3e5f5
    classDef composite fill:#fff3e0
    classDef utility fill:#e8f5e9
    
    class string base
    class NodeId,TreeId,EntityId,WorkingCopyId branded
    class TreeNode,Entity,WorkingCopy composite
    class Result,Maybe,Brand utility
```

### 14.2 型安全性パターン (Type Safety Patterns) ⭐️⭐️⭐️⭐️⭐️

| パターン | 用途 | 実装 | 利点 |
|----------|------|------|------|
| **ブランデッドタイプ** | ID の型安全性 | `type NodeId = string & { __brand: 'NodeId' }` | コンパイル時エラー検出 |
| **判別共用体** | 状態管理 | `type Result<T, E> = Success<T> \| Error<E>` | 網羅的パターンマッチング |
| **型ガード** | 実行時型チェック | `function isNodeId(value: unknown): value is NodeId` | 境界での型安全性 |
| **アサーション関数** | 型の強制 | `function assertNodeId(value: unknown): asserts value is NodeId` | null 安全性 |

```typescript
// ブランデッドタイプの定義例
type NodeId = string & { readonly __brand: 'NodeId' };
type TreeId = string & { readonly __brand: 'TreeId' };
type EntityId = string & { readonly __brand: 'EntityId' };

// 型安全なキャスト
function createNodeId(id: string): NodeId {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Invalid NodeId');
  }
  return id as NodeId;
}

// Result型による安全なエラーハンドリング
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// 型ガード関数
function isValidNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && value.length > 0;
}
```

### 14.3 共通インターフェース (Common Interfaces) ⭐️⭐️⭐️⭐️

```mermaid
graph LR
    subgraph "Base Interfaces"
        Identifiable["Identifiable<TId>"]
        Timestamped["Timestamped"]
        Versioned["Versioned"]
    end
    
    subgraph "Domain Interfaces"
        TreeNodeBase["TreeNodeBase"]
        EntityBase["EntityBase<TEntity>"]
        HandlerBase["HandlerBase<TEntity>"]
    end
    
    subgraph "Utility Interfaces"
        Disposable["Disposable"]
        Serializable["Serializable<T>"]
        Observable["Observable<T>"]
    end
    
    subgraph "Specific Types"
        TreeNodeEntity["TreeNodeEntity"]
        PluginEntity["PluginEntity"]
        WorkingCopyEntity["WorkingCopyEntity"]
    end
    
    Identifiable --> TreeNodeBase
    Timestamped --> EntityBase
    Versioned --> HandlerBase
    
    TreeNodeBase --> TreeNodeEntity
    EntityBase --> PluginEntity
    HandlerBase --> WorkingCopyEntity
    
    Disposable --> Observable
    Serializable --> Observable
    
    classDef base fill:#e1f5fe
    classDef domain fill:#f3e5f5
    classDef utility fill:#fff3e0
    classDef specific fill:#e8f5e9
    
    class Identifiable,Timestamped,Versioned base
    class TreeNodeBase,EntityBase,HandlerBase domain
    class Disposable,Serializable,Observable utility
    class TreeNodeEntity,PluginEntity,WorkingCopyEntity specific
```

## Chapter 15: ユーティリティライブラリ (Utility Libraries) ⭐️⭐️⭐️⭐️⭐️

### 15.1 ID生成とバリデーション (ID Generation and Validation) ⭐️⭐️⭐️⭐️⭐️

```mermaid
graph TB
    subgraph "ID Generation"
        UUIDv4["UUID v4 Generator"]
        NanoID["NanoID Generator"]
        CustomID["Custom ID Generator"]
    end
    
    subgraph "ID Validation"
        FormatValidator["Format Validator"]
        UniquenessValidator["Uniqueness Validator"]
        TypeValidator["Type Validator"]
    end
    
    subgraph "ID Utilities"
        IDConverter["ID Converter"]
        IDComparator["ID Comparator"]
        IDIndexer["ID Indexer"]
    end
    
    subgraph "Safety Mechanisms"
        BrandedCasting["Branded Casting"]
        RuntimeChecks["Runtime Checks"]
        ErrorReporting["Error Reporting"]
    end
    
    UUIDv4 --> FormatValidator
    NanoID --> UniquenessValidator
    CustomID --> TypeValidator
    
    FormatValidator --> IDConverter
    UniquenessValidator --> IDComparator
    TypeValidator --> IDIndexer
    
    IDConverter --> BrandedCasting
    IDComparator --> RuntimeChecks
    IDIndexer --> ErrorReporting
    
    classDef generator fill:#e1f5fe
    classDef validator fill:#f3e5f5
    classDef utility fill:#fff3e0
    classDef safety fill:#ffebee
    
    class UUIDv4,NanoID,CustomID generator
    class FormatValidator,UniquenessValidator,TypeValidator validator
    class IDConverter,IDComparator,IDIndexer utility
    class BrandedCasting,RuntimeChecks,ErrorReporting safety
```

### 15.2 ロギングとモニタリング (Logging and Monitoring) ⭐️⭐️⭐️⭐️

| 機能カテゴリ | ツール | 目的 | 実装詳細 |
|--------------|--------|------|----------|
| **構造化ログ** | winston/pino | ログの統一フォーマット | JSON形式、ログレベル管理 |
| **パフォーマンス** | Web Vitals | ユーザー体験指標 | FCP, LCP, FID, CLS測定 |
| **エラートラッキング** | カスタムError | エラー詳細記録 | スタックトレース、コンテキスト |
| **メモリ監視** | Memory API | メモリリーク検出 | ヒープ使用量、GC頻度 |
| **DB監視** | Dexie hooks | データベース操作 | クエリ時間、トランザクション監視 |

### 15.3 非同期処理ユーティリティ (Async Processing Utilities) ⭐️⭐️⭐️⭐️

```mermaid
graph LR
    subgraph "Promise Utilities"
        PromiseAll["Promise.all variants"]
        PromiseRace["Promise.race variants"]
        PromiseRetry["Promise retry logic"]
    end
    
    subgraph "Async Iterators"
        AsyncMap["Async map"]
        AsyncFilter["Async filter"]
        AsyncReduce["Async reduce"]
    end
    
    subgraph "Concurrency Control"
        Semaphore["Semaphore"]
        Queue["Task Queue"]
        RateLimiter["Rate Limiter"]
    end
    
    subgraph "Error Handling"
        TimeoutWrapper["Timeout Wrapper"]
        CircuitBreaker["Circuit Breaker"]
        RetryWithBackoff["Retry with Backoff"]
    end
    
    PromiseAll --> AsyncMap
    PromiseRace --> AsyncFilter
    PromiseRetry --> AsyncReduce
    
    AsyncMap --> Semaphore
    AsyncFilter --> Queue
    AsyncReduce --> RateLimiter
    
    Semaphore --> TimeoutWrapper
    Queue --> CircuitBreaker
    RateLimiter --> RetryWithBackoff
    
    classDef promise fill:#e1f5fe
    classDef iterator fill:#f3e5f5
    classDef concurrency fill:#fff3e0
    classDef error fill:#ffebee
    
    class PromiseAll,PromiseRace,PromiseRetry promise
    class AsyncMap,AsyncFilter,AsyncReduce iterator
    class Semaphore,Queue,RateLimiter concurrency
    class TimeoutWrapper,CircuitBreaker,RetryWithBackoff error
```

## Chapter 16: 状態管理ライブラリ (State Management Libraries) ⭐️⭐️⭐️⭐️

### 16.1 Working Copy システム (Working Copy System) ⭐️⭐️⭐️⭐️⭐️

Working Copyパターンは、HierarchiDBの中核的な状態管理メカニズムです。

```mermaid
graph TB
    subgraph "CoreDB (Persistent)"
        OriginalNode["Original Node"]
        CommittedState["Committed State"]
    end
    
    subgraph "EphemeralDB (Temporary)"
        WorkingCopy["Working Copy"]
        DraftChanges["Draft Changes"]
        UndoStack["Undo Stack"]
        RedoStack["Redo Stack"]
    end
    
    subgraph "Operations"
        CreateCopy["createWorkingCopy()"]
        ModifyCopy["modifyWorkingCopy()"]
        CommitChanges["commitChanges()"]
        DiscardChanges["discardChanges()"]
    end
    
    subgraph "State Synchronization"
        DiffCalculation["Diff Calculation"]
        MergeResolution["Merge Resolution"]
        ConflictDetection["Conflict Detection"]
    end
    
    OriginalNode --> CreateCopy
    CreateCopy --> WorkingCopy
    WorkingCopy --> ModifyCopy
    ModifyCopy --> DraftChanges
    
    DraftChanges --> CommitChanges
    CommitChanges --> CommittedState
    
    DraftChanges --> DiscardChanges
    DiscardChanges --> OriginalNode
    
    WorkingCopy --> UndoStack
    UndoStack --> RedoStack
    
    DraftChanges --> DiffCalculation
    DiffCalculation --> MergeResolution
    MergeResolution --> ConflictDetection
    
    classDef persistent fill:#e8f5e9
    classDef temporary fill:#fff3e0
    classDef operations fill:#f3e5f5
    classDef sync fill:#e1f5fe
    
    class OriginalNode,CommittedState persistent
    class WorkingCopy,DraftChanges,UndoStack,RedoStack temporary
    class CreateCopy,ModifyCopy,CommitChanges,DiscardChanges operations
    class DiffCalculation,MergeResolution,ConflictDetection sync
```

### 16.2 リアクティブ状態管理 (Reactive State Management) ⭐️⭐️⭐️⭐️

| パターン | 実装 | 用途 | パフォーマンス特性 |
|----------|------|------|--------------------|
| **Observer Pattern** | カスタムObservable | ノード変更通知 | O(n) 通知、低メモリ |
| **Subscription Model** | WeakMap + WeakRef | UI コンポーネント購読 | O(1) 購読、自動GC |
| **Event Emitter** | Node.js EventEmitter | 横断的なイベント | O(1) 発行、O(n) 配信 |
| **Signal Pattern** | React状態同期 | 細粒度状態更新 | O(1) 更新、バッチング対応 |

### 16.3 キャッシング戦略 (Caching Strategy) ⭐️⭐️⭐️

```mermaid
graph LR
    subgraph "Cache Levels"
        L1["L1: Component Cache"]
        L2["L2: Service Cache"]
        L3["L3: Database Cache"]
        L4["L4: Network Cache"]
    end
    
    subgraph "Cache Types"
        LRU["LRU Cache"]
        TTL["TTL Cache"]
        WriteThrough["Write-Through"]
        WriteBack["Write-Back"]
    end
    
    subgraph "Invalidation"
        TimeBasedInvalidation["Time-Based"]
        EventBasedInvalidation["Event-Based"]
        ManualInvalidation["Manual"]
    end
    
    subgraph "Performance"
        HitRateMonitoring["Hit Rate Monitoring"]
        SizeManagement["Size Management"]
        MemoryPressure["Memory Pressure"]
    end
    
    L1 --> LRU
    L2 --> TTL
    L3 --> WriteThrough
    L4 --> WriteBack
    
    LRU --> TimeBasedInvalidation
    TTL --> EventBasedInvalidation
    WriteThrough --> ManualInvalidation
    WriteBack --> TimeBasedInvalidation
    
    TimeBasedInvalidation --> HitRateMonitoring
    EventBasedInvalidation --> SizeManagement
    ManualInvalidation --> MemoryPressure
    
    classDef level fill:#e1f5fe
    classDef type fill:#f3e5f5
    classDef invalidation fill:#fff3e0
    classDef performance fill:#e8f5e9
    
    class L1,L2,L3,L4 level
    class LRU,TTL,WriteThrough,WriteBack type
    class TimeBasedInvalidation,EventBasedInvalidation,ManualInvalidation invalidation
    class HitRateMonitoring,SizeManagement,MemoryPressure performance
```

## Chapter 17: バリデーションとエラーハンドリング (Validation and Error Handling) ⭐️⭐️⭐️⭐️

### 17.1 統一エラーハンドリングシステム (Unified Error Handling System) ⭐️⭐️⭐️⭐️

```mermaid
graph TB
    subgraph "Error Types"
        ValidationError["ValidationError"]
        DatabaseError["DatabaseError"]
        NetworkError["NetworkError"]
        AuthenticationError["AuthenticationError"]
        BusinessLogicError["BusinessLogicError"]
    end
    
    subgraph "Error Context"
        ErrorCode["Error Code"]
        ErrorMessage["Error Message"]
        StackTrace["Stack Trace"]
        UserContext["User Context"]
        OperationContext["Operation Context"]
    end
    
    subgraph "Error Handling"
        GlobalErrorBoundary["Global Error Boundary"]
        LocalErrorHandler["Local Error Handler"]
        AsyncErrorHandler["Async Error Handler"]
    end
    
    subgraph "Error Recovery"
        RetryMechanism["Retry Mechanism"]
        FallbackStrategy["Fallback Strategy"]
        GracefulDegradation["Graceful Degradation"]
    end
    
    ValidationError --> ErrorCode
    DatabaseError --> ErrorMessage
    NetworkError --> StackTrace
    AuthenticationError --> UserContext
    BusinessLogicError --> OperationContext
    
    ErrorCode --> GlobalErrorBoundary
    ErrorMessage --> LocalErrorHandler
    StackTrace --> AsyncErrorHandler
    
    GlobalErrorBoundary --> RetryMechanism
    LocalErrorHandler --> FallbackStrategy
    AsyncErrorHandler --> GracefulDegradation
    
    classDef errortype fill:#ffebee
    classDef context fill:#f3e5f5
    classDef handling fill:#fff3e0
    classDef recovery fill:#e8f5e9
    
    class ValidationError,DatabaseError,NetworkError,AuthenticationError,BusinessLogicError errortype
    class ErrorCode,ErrorMessage,StackTrace,UserContext,OperationContext context
    class GlobalErrorBoundary,LocalErrorHandler,AsyncErrorHandler handling
    class RetryMechanism,FallbackStrategy,GracefulDegradation recovery
```

### 17.2 データバリデーション (Data Validation) ⭐️⭐️⭐️⭐️

| バリデーション層 | 責任 | 実装 | エラーレベル |
|------------------|------|------|-------------|
| **スキーマバリデーション** | データ型・構造チェック | Zod/Joi schemas | Critical |
| **ビジネスルール** | ドメイン固有制約 | カスタムバリデータ | Warning |
| **入力サニタイゼーション** | XSS/インジェクション対策 | DOMPurify | Security |
| **境界値チェック** | 範囲・サイズ制限 | 数値・文字列バリデータ | Error |
| **参照整合性** | ID参照チェック | データベースクエリ | Critical |

### 17.3 Result型によるエラー管理 (Error Management with Result Types) ⭐️⭐️⭐️⭐️

```typescript
// Result型の定義
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Result型のユーティリティ
class ResultUtils {
  static success<T>(data: T): Result<T> {
    return { success: true, data };
  }
  
  static error<E>(error: E): Result<never, E> {
    return { success: false, error };
  }
  
  static map<T, U>(result: Result<T>, fn: (data: T) => U): Result<U> {
    return result.success 
      ? ResultUtils.success(fn(result.data))
      : result;
  }
  
  static flatMap<T, U>(
    result: Result<T>, 
    fn: (data: T) => Result<U>
  ): Result<U> {
    return result.success ? fn(result.data) : result;
  }
}

// 使用例
async function createNode(nodeData: NodeData): Promise<Result<NodeId>> {
  try {
    // バリデーション
    const validationResult = validateNodeData(nodeData);
    if (!validationResult.success) {
      return ResultUtils.error(validationResult.error);
    }
    
    // ノード作成
    const nodeId = await database.createNode(validationResult.data);
    return ResultUtils.success(nodeId);
    
  } catch (error) {
    return ResultUtils.error(error as Error);
  }
}
```

## まとめ (Summary) ⭐️⭐️⭐️⭐️

共通ライブラリは、HierarchiDBの基盤となる型安全で再利用可能なコンポーネント群を提供します：

- **型システム**: ブランデッドタイプによる厳格な型安全性
- **ユーティリティ**: ID生成、ロギング、非同期処理の統一API
- **状態管理**: Working Copyパターンによる安全な状態管理
- **エラーハンドリング**: Result型による関数型エラーハンドリング

これらのライブラリにより、開発者は一貫した品質とパフォーマンスを保ちながら機能開発に集中できます。