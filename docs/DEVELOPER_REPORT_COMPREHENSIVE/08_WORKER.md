# 第8部 Worker (Web Worker Layer)

## Chapter 21: Worker アーキテクチャ (Worker Architecture) ⭐️⭐️⭐️⭐️⭐️

### 21.1 Worker層の責任分離 (Worker Layer Separation of Concerns) ⭐️⭐️⭐️⭐️⭐️

HierarchiDBのWorker層は、データベース操作とビジネスロジックを担当する独立したレイヤーです。UI層から完全に分離され、高いパフォーマンスと安全性を提供します。

```mermaid
graph TB
    subgraph "Main Thread (UI Layer)"
        ReactApp["React Application"]
        UIComponents["UI Components"]
        EventHandlers["Event Handlers"]
    end
    
    subgraph "Web Worker Thread"
        WorkerEntry["Worker Entry Point"]
        APIImplementation["API Implementation"]
        ServiceLayer["Service Layer"]
        CommandProcessor["Command Processor"]
        EntityHandlers["Entity Handlers"]
        DatabaseAccess["Database Access"]
    end
    
    subgraph "Comlink Communication"
        MainThreadProxy["Main Thread Proxy"]
        WorkerExpose["Worker Expose"]
        MessageChannel["Message Channel"]
    end
    
    subgraph "Database Layer"
        CoreDB["CoreDB (Dexie)"]
        EphemeralDB["EphemeralDB (Dexie)"]
        IndexedDB["IndexedDB"]
    end
    
    ReactApp --> MainThreadProxy
    UIComponents --> MainThreadProxy
    EventHandlers --> MainThreadProxy
    
    MainThreadProxy -.-> MessageChannel
    MessageChannel -.-> WorkerExpose
    WorkerExpose --> WorkerEntry
    
    WorkerEntry --> APIImplementation
    APIImplementation --> ServiceLayer
    ServiceLayer --> CommandProcessor
    CommandProcessor --> EntityHandlers
    EntityHandlers --> DatabaseAccess
    
    DatabaseAccess --> CoreDB
    DatabaseAccess --> EphemeralDB
    CoreDB --> IndexedDB
    EphemeralDB --> IndexedDB
    
    classDef ui fill:#e1f5fe
    classDef worker fill:#f3e5f5
    classDef communication fill:#fff3e0
    classDef database fill:#e8f5e9
    
    class ReactApp,UIComponents,EventHandlers ui
    class WorkerEntry,APIImplementation,ServiceLayer,CommandProcessor,EntityHandlers,DatabaseAccess worker
    class MainThreadProxy,WorkerExpose,MessageChannel communication
    class CoreDB,EphemeralDB,IndexedDB database
```

### 21.2 Worker初期化プロセス (Worker Initialization Process) ⭐️⭐️⭐️⭐️⭐️

| フェーズ | 処理内容 | 責任者 | エラーハンドリング |
|----------|----------|--------|-------------------|
| **1. Worker起動** | Web Worker インスタンス作成 | Main Thread | Worker loading timeout |
| **2. 通信確立** | Comlink RPC 接続 | Both threads | Connection retry logic |
| **3. データベース初期化** | IndexedDB スキーマ作成 | Worker Thread | Schema migration |
| **4. プラグイン登録** | ノードタイプ登録 | Worker Thread | Plugin validation |
| **5. サービス開始** | API サービス有効化 | Worker Thread | Health check |

```typescript
// Worker初期化の実装例
class WorkerInitializer {
  private static instance: WorkerInitializer;
  private initializationPromise: Promise<void> | null = null;
  
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }
  
  private async performInitialization(): Promise<void> {
    try {
      // 1. データベース初期化
      await this.initializeDatabases();
      
      // 2. プラグイン登録
      await this.registerPlugins();
      
      // 3. サービス開始
      await this.startServices();
      
      // 4. ヘルスチェック
      await this.performHealthCheck();
      
    } catch (error) {
      await this.handleInitializationError(error);
      throw error;
    }
  }
  
  private async initializeDatabases(): Promise<void> {
    // CoreDB初期化
    await CoreDBManager.initialize({
      name: 'hierarchidb-core',
      version: 1,
      stores: ['trees', 'nodes', 'rootStates']
    });
    
    // EphemeralDB初期化
    await EphemeralDBManager.initialize({
      name: 'hierarchidb-ephemeral',
      version: 1,
      stores: ['workingCopies', 'viewStates', 'temporaryData']
    });
  }
}
```

### 21.3 Worker パフォーマンス最適化 (Worker Performance Optimization) ⭐️⭐️⭐️⭐️

```mermaid
graph LR
    subgraph "CPU最適化"
        BatchProcessing["Batch Processing"]
        TaskScheduling["Task Scheduling"]
        IdleCallback["Idle Callback"]
    end
    
    subgraph "メモリ最適化"
        ObjectPooling["Object Pooling"]
        WeakReferences["Weak References"]
        GCOptimization["GC Optimization"]
    end
    
    subgraph "I/O最適化"
        TransactionBatching["Transaction Batching"]
        IndexOptimization["Index Optimization"]
        QueryPlanning["Query Planning"]
    end
    
    subgraph "通信最適化"
        MessageBatching["Message Batching"]
        TransferableObjects["Transferable Objects"]
        CompressionOptimization["Compression"]
    end
    
    BatchProcessing --> ObjectPooling
    TaskScheduling --> WeakReferences
    IdleCallback --> GCOptimization
    
    ObjectPooling --> TransactionBatching
    WeakReferences --> IndexOptimization
    GCOptimization --> QueryPlanning
    
    TransactionBatching --> MessageBatching
    IndexOptimization --> TransferableObjects
    QueryPlanning --> CompressionOptimization
    
    classDef cpu fill:#e1f5fe
    classDef memory fill:#f3e5f5
    classDef io fill:#fff3e0
    classDef communication fill:#e8f5e9
    
    class BatchProcessing,TaskScheduling,IdleCallback cpu
    class ObjectPooling,WeakReferences,GCOptimization memory
    class TransactionBatching,IndexOptimization,QueryPlanning io
    class MessageBatching,TransferableObjects,CompressionOptimization communication
```

## Chapter 22: データベース管理 (Database Management) ⭐️⭐️⭐️⭐️⭐️

### 22.1 デュアルデータベース戦略 (Dual Database Strategy) ⭐️⭐️⭐️⭐️⭐️

```mermaid
graph TB
    subgraph "CoreDB (Persistent Storage)"
        Trees["Trees Table"]
        Nodes["Nodes Table"]
        RootStates["Root States Table"]
        PluginEntities["Plugin Entity Tables"]
    end
    
    subgraph "EphemeralDB (Temporary Storage)"
        WorkingCopies["Working Copies Table"]
        ViewStates["View States Table"]
        TemporaryData["Temporary Data Table"]
        UndoRedoStack["Undo/Redo Stack"]
    end
    
    subgraph "Data Flow"
        CreateWorkingCopy["Create Working Copy"]
        ModifyData["Modify Data"]
        CommitChanges["Commit Changes"]
        DiscardChanges["Discard Changes"]
    end
    
    subgraph "Synchronization"
        DiffCalculation["Diff Calculation"]
        MergeConflictResolution["Merge Conflict Resolution"]
        VersionManagement["Version Management"]
    end
    
    Nodes --> CreateWorkingCopy
    CreateWorkingCopy --> WorkingCopies
    WorkingCopies --> ModifyData
    ModifyData --> WorkingCopies
    
    WorkingCopies --> CommitChanges
    CommitChanges --> Nodes
    WorkingCopies --> DiscardChanges
    
    WorkingCopies --> DiffCalculation
    DiffCalculation --> MergeConflictResolution
    MergeConflictResolution --> VersionManagement
    VersionManagement --> Nodes
    
    classDef persistent fill:#e8f5e9
    classDef temporary fill:#fff3e0
    classDef flow fill:#f3e5f5
    classDef sync fill:#e1f5fe
    
    class Trees,Nodes,RootStates,PluginEntities persistent
    class WorkingCopies,ViewStates,TemporaryData,UndoRedoStack temporary
    class CreateWorkingCopy,ModifyData,CommitChanges,DiscardChanges flow
    class DiffCalculation,MergeConflictResolution,VersionManagement sync
```

### 22.2 トランザクション管理 (Transaction Management) ⭐️⭐️⭐️⭐️

| トランザクションタイプ | 対象データベース | 分離レベル | 期間 | 用途 |
|----------------------|------------------|------------|------|------|
| **Short Transaction** | CoreDB | Read Committed | < 100ms | 単一ノード操作 |
| **Long Transaction** | EphemeralDB | Serializable | 1-60分 | Working Copy編集 |
| **Batch Transaction** | CoreDB | Read Committed | < 5秒 | 一括データ操作 |
| **Cross-DB Transaction** | Both | Snapshot | < 1秒 | Working Copy コミット |
| **Read-Only Transaction** | CoreDB | Read Uncommitted | < 50ms | クエリ専用 |

```typescript
// トランザクション管理の実装
class TransactionManager {
  private activeTransactions = new Map<string, Transaction>();
  
  async executeInTransaction<T>(
    operation: (tx: Transaction) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<Result<T>> {
    const txId = this.generateTransactionId();
    const tx = await this.beginTransaction(options);
    
    try {
      this.activeTransactions.set(txId, tx);
      
      const result = await operation(tx);
      await tx.commit();
      
      return Result.success(result);
      
    } catch (error) {
      await tx.rollback();
      return Result.error(error as Error);
      
    } finally {
      this.activeTransactions.delete(txId);
    }
  }
  
  async executeBatchOperation<T>(
    operations: BatchOperation<T>[],
    options: BatchOptions = {}
  ): Promise<Result<T[]>> {
    return this.executeInTransaction(async (tx) => {
      const results: T[] = [];
      
      for (const operation of operations) {
        const result = await operation.execute(tx);
        results.push(result);
        
        // Progress callback
        if (options.onProgress) {
          options.onProgress(results.length, operations.length);
        }
      }
      
      return results;
    }, {
      isolationLevel: 'READ_COMMITTED',
      timeout: options.batchTimeout || 30000
    });
  }
}
```

### 22.3 インデックス最適化戦略 (Index Optimization Strategy) ⭐️⭐️⭐️⭐️⭐️

```mermaid
graph LR
    subgraph "Primary Indexes"
        TreeIdIndex["TreeId Index"]
        NodeIdIndex["NodeId Index"]
        EntityIdIndex["EntityId Index"]
    end
    
    subgraph "Composite Indexes"
        ParentChildIndex["[parentNodeId+name]"]
        TimeSeriesIndex["[parentNodeId+updatedAt]"]
        StatusIndex["[nodeType+status]"]
    end
    
    subgraph "Search Indexes"
        FullTextIndex["Full Text Search"]
        TagIndex["Tag Index"]
        ContentIndex["Content Index"]
    end
    
    subgraph "Performance Indexes"
        FrequentQueries["Frequent Query Index"]
        SpatialIndex["Spatial Index"]
        BitmapIndex["Bitmap Index"]
    end
    
    TreeIdIndex --> ParentChildIndex
    NodeIdIndex --> TimeSeriesIndex
    EntityIdIndex --> StatusIndex
    
    ParentChildIndex --> FullTextIndex
    TimeSeriesIndex --> TagIndex
    StatusIndex --> ContentIndex
    
    FullTextIndex --> FrequentQueries
    TagIndex --> SpatialIndex
    ContentIndex --> BitmapIndex
    
    classDef primary fill:#e1f5fe
    classDef composite fill:#f3e5f5
    classDef search fill:#fff3e0
    classDef performance fill:#e8f5e9
    
    class TreeIdIndex,NodeIdIndex,EntityIdIndex primary
    class ParentChildIndex,TimeSeriesIndex,StatusIndex composite
    class FullTextIndex,TagIndex,ContentIndex search
    class FrequentQueries,SpatialIndex,BitmapIndex performance
```

## Chapter 23: コマンドプロセッサ (Command Processor) ⭐️⭐️⭐️⭐️

### 23.1 コマンドパターン実装 (Command Pattern Implementation) ⭐️⭐️⭐️⭐️⭐️

```mermaid
graph TB
    subgraph "Command Interface"
        ICommand["ICommand Interface"]
        IUndoableCommand["IUndoableCommand Interface"]
        IBatchCommand["IBatchCommand Interface"]
    end
    
    subgraph "Concrete Commands"
        CreateNodeCommand["CreateNodeCommand"]
        UpdateNodeCommand["UpdateNodeCommand"]
        DeleteNodeCommand["DeleteNodeCommand"]
        MoveNodeCommand["MoveNodeCommand"]
        BatchCommand["BatchCommand"]
    end
    
    subgraph "Command Processing"
        CommandQueue["Command Queue"]
        CommandExecutor["Command Executor"]
        CommandValidator["Command Validator"]
    end
    
    subgraph "Undo/Redo System"
        UndoStack["Undo Stack"]
        RedoStack["Redo Stack"]
        SnapshotManager["Snapshot Manager"]
    end
    
    ICommand --> CreateNodeCommand
    IUndoableCommand --> UpdateNodeCommand
    IBatchCommand --> DeleteNodeCommand
    ICommand --> MoveNodeCommand
    IBatchCommand --> BatchCommand
    
    CreateNodeCommand --> CommandQueue
    UpdateNodeCommand --> CommandExecutor
    DeleteNodeCommand --> CommandValidator
    
    CommandExecutor --> UndoStack
    CommandValidator --> RedoStack
    CommandQueue --> SnapshotManager
    
    classDef interface fill:#ffebee
    classDef concrete fill:#f3e5f5
    classDef processing fill:#fff3e0
    classDef undoredo fill:#e8f5e9
    
    class ICommand,IUndoableCommand,IBatchCommand interface
    class CreateNodeCommand,UpdateNodeCommand,DeleteNodeCommand,MoveNodeCommand,BatchCommand concrete
    class CommandQueue,CommandExecutor,CommandValidator processing
    class UndoStack,RedoStack,SnapshotManager undoredo
```

### 23.2 コマンド実行フロー (Command Execution Flow) ⭐️⭐️⭐️⭐️

| フェーズ | 処理内容 | バリデーション | エラー対応 |
|----------|----------|----------------|------------|
| **1. 受信** | コマンド受信・パース | 構文チェック | Invalid command format |
| **2. 検証** | 権限・制約チェック | ビジネスルール | Permission denied |
| **3. 準備** | 前提条件確認 | データ整合性 | Precondition failed |
| **4. 実行** | データベース操作 | トランザクション | Database error |
| **5. 通知** | 変更通知送信 | サブスクリプション | Notification failure |
| **6. 記録** | Undo スタック更新 | 履歴管理 | History corruption |

```typescript
// コマンド実装の例
abstract class BaseCommand<TData = any, TResult = void> implements ICommand<TData, TResult> {
  protected readonly id: string;
  protected readonly timestamp: number;
  protected readonly data: TData;
  
  constructor(data: TData) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.data = data;
  }
  
  abstract validate(context: CommandContext): Promise<ValidationResult>;
  abstract execute(context: CommandContext): Promise<Result<TResult>>;
  
  // デフォルトのUndoサポート
  async undo(context: CommandContext): Promise<Result<void>> {
    throw new Error('Undo not implemented for this command');
  }
}

class CreateNodeCommand extends BaseCommand<CreateNodeData, NodeId> implements IUndoableCommand {
  async validate(context: CommandContext): Promise<ValidationResult> {
    // 親ノード存在チェック
    const parentExists = await context.database.nodeExists(this.data.parentNodeId);
    if (!parentExists) {
      return ValidationResult.error('Parent node does not exist');
    }
    
    // 名前重複チェック
    const nameConflict = await context.database.hasChildWithName(
      this.data.parentNodeId, 
      this.data.name
    );
    if (nameConflict) {
      return ValidationResult.error('Node name already exists');
    }
    
    return ValidationResult.success();
  }
  
  async execute(context: CommandContext): Promise<Result<NodeId>> {
    try {
      const nodeId = await context.database.createNode({
        id: generateNodeId() as NodeId,
        parentNodeId: this.data.parentNodeId,
        name: this.data.name,
        nodeType: this.data.nodeType,
        createdAt: this.timestamp,
        updatedAt: this.timestamp,
        version: 1
      });
      
      // ライフサイクルフック実行
      await context.pluginManager.executeHook('afterCreate', {
        nodeId,
        data: this.data
      });
      
      return Result.success(nodeId);
      
    } catch (error) {
      return Result.error(error as Error);
    }
  }
  
  async undo(context: CommandContext): Promise<Result<void>> {
    // Undoは削除コマンドの実行
    const deleteCommand = new DeleteNodeCommand({ 
      nodeId: this.getCreatedNodeId() 
    });
    
    return deleteCommand.execute(context).then(() => Result.success());
  }
}
```

### 23.3 パフォーマンス最適化 (Performance Optimization) ⭐️⭐️⭐️⭐️⭐️

```mermaid
graph LR
    subgraph "バッチ処理最適化"
        CommandBatching["Command Batching"]
        TransactionMerging["Transaction Merging"]
        BulkOperations["Bulk Operations"]
    end
    
    subgraph "並列実行最適化"
        ParallelExecution["Parallel Execution"]
        DependencyAnalysis["Dependency Analysis"]
        ThreadPooling["Thread Pooling"]
    end
    
    subgraph "キャッシング最適化"
        CommandCache["Command Cache"]
        ResultCache["Result Cache"]
        ValidationCache["Validation Cache"]
    end
    
    subgraph "メモリ最適化"
        CommandPooling["Command Pooling"]
        MemoryProfiling["Memory Profiling"]
        GarbageCollection["Garbage Collection"]
    end
    
    CommandBatching --> ParallelExecution
    TransactionMerging --> DependencyAnalysis
    BulkOperations --> ThreadPooling
    
    ParallelExecution --> CommandCache
    DependencyAnalysis --> ResultCache
    ThreadPooling --> ValidationCache
    
    CommandCache --> CommandPooling
    ResultCache --> MemoryProfiling
    ValidationCache --> GarbageCollection
    
    classDef batch fill:#e1f5fe
    classDef parallel fill:#f3e5f5
    classDef cache fill:#fff3e0
    classDef memory fill:#e8f5e9
    
    class CommandBatching,TransactionMerging,BulkOperations batch
    class ParallelExecution,DependencyAnalysis,ThreadPooling parallel
    class CommandCache,ResultCache,ValidationCache cache
    class CommandPooling,MemoryProfiling,GarbageCollection memory
```

## まとめ (Summary)

Worker層では、堅牢で高性能なデータ処理システムを構築しました：

- **アーキテクチャ**: UI層から完全分離されたWorkerスレッド
- **データベース管理**: デュアルデータベース戦略による安全な状態管理
- **コマンドプロセッサ**: Undo/Redo対応のコマンドパターン実装

この設計により、メインスレッドをブロックすることなく、大規模データの安全で高速な処理を実現しています。