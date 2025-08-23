# 第7部 API (Application Programming Interface)

## Chapter 18: Worker API インターフェース (Worker API Interface)

### 18.1 Comlink RPC アーキテクチャ (Comlink RPC Architecture)

HierarchiDBのAPI層は、Comlink RPCを基盤とした非同期通信システムです。UI層とWorker層間の型安全な通信を実現します。

```mermaid
graph TB
    subgraph "UI Layer (Main Thread)"
        ReactComponents["React Components"]
        APIClient["API Client (Proxy)"]
        TypedInterfaces["Typed Interfaces"]
    end
    
    subgraph "Comlink RPC Layer"
        Serialization["Serialization"]
        Deserialization["Deserialization"]
        MessagePassing["Message Passing"]
        ErrorMarshaling["Error Marshaling"]
    end
    
    subgraph "Worker Layer (Web Worker)"
        WorkerAPIImpl["Worker API Implementation"]
        ServiceLayer["Service Layer"]
        DatabaseAccess["Database Access"]
    end
    
    subgraph "Transfer Objects"
        Transferables["Transferable Objects"]
        SharedArrayBuffer["SharedArrayBuffer"]
        MessagePort["MessagePort"]
    end
    
    ReactComponents --> APIClient
    APIClient --> TypedInterfaces
    TypedInterfaces --> Serialization
    
    Serialization --> MessagePassing
    MessagePassing --> Deserialization
    Deserialization --> WorkerAPIImpl
    
    WorkerAPIImpl --> ServiceLayer
    ServiceLayer --> DatabaseAccess
    
    MessagePassing --> Transferables
    MessagePassing --> SharedArrayBuffer
    MessagePassing --> MessagePort
    
    ErrorMarshaling --> Serialization
    
    classDef ui fill:#e1f5fe
    classDef rpc fill:#f3e5f5
    classDef worker fill:#fff3e0
    classDef transfer fill:#e8f5e9
    
    class ReactComponents,APIClient,TypedInterfaces ui
    class Serialization,Deserialization,MessagePassing,ErrorMarshaling rpc
    class WorkerAPIImpl,ServiceLayer,DatabaseAccess worker
    class Transferables,SharedArrayBuffer,MessagePort transfer
```

### 18.2 API契約定義 (API Contract Definition)

| API カテゴリ | インターフェース | 目的 | 型安全性 |
|--------------|------------------|------|----------|
| **ツリー操作** | `ITreeAPI` | ツリー構造管理 | `TreeId`, `NodeId` branded types |
| **ノード操作** | `INodeAPI` | ノード CRUD 操作 | `NodeId` validation + type guards |
| **エンティティ管理** | `IEntityAPI` | プラグインエンティティ | `EntityId` generic constraints |
| **Working Copy** | `IWorkingCopyAPI` | 作業コピー管理 | `WorkingCopyId` lifecycle |
| **サブスクリプション** | `ISubscriptionAPI` | リアルタイム通知 | Observer pattern with types |

```typescript
// API インターフェースの例
interface ITreeAPI {
  // ツリー作成
  createTree(name: string): Promise<Result<TreeId>>;
  
  // ツリー削除
  deleteTree(treeId: TreeId): Promise<Result<void>>;
  
  // ルートノード取得
  getRootNode(treeId: TreeId): Promise<Result<TreeNode>>;
  
  // 子ノード一覧取得
  getChildNodes(
    parentNodeId: NodeId, 
    options?: QueryOptions
  ): Promise<Result<TreeNode[]>>;
}

interface INodeAPI {
  // ノード作成
  createNode(
    parentNodeId: NodeId, 
    nodeData: CreateNodeData
  ): Promise<Result<NodeId>>;
  
  // ノード更新
  updateNode(
    nodeId: NodeId, 
    updates: Partial<UpdateNodeData>
  ): Promise<Result<void>>;
  
  // ノード削除
  deleteNode(nodeId: NodeId): Promise<Result<void>>;
  
  // ノード移動
  moveNode(
    nodeId: NodeId, 
    newParentId: NodeId, 
    position?: number
  ): Promise<Result<void>>;
}

interface IWorkingCopyAPI {
  // 作業コピー作成
  createWorkingCopy(
    nodeId: NodeId
  ): Promise<Result<WorkingCopyId>>;
  
  // 作業コピー更新
  updateWorkingCopy(
    workingCopyId: WorkingCopyId, 
    changes: WorkingCopyChanges
  ): Promise<Result<void>>;
  
  // 変更コミット
  commitWorkingCopy(
    workingCopyId: WorkingCopyId
  ): Promise<Result<NodeId>>;
  
  // 変更破棄
  discardWorkingCopy(
    workingCopyId: WorkingCopyId
  ): Promise<Result<void>>;
}
```

### 18.3 エラーハンドリング戦略 (Error Handling Strategy)

```mermaid
graph LR
    subgraph "Error Types"
        ValidationError["ValidationError"]
        DatabaseError["DatabaseError"]
        NetworkError["NetworkError"]
        AuthError["AuthenticationError"]
        BusinessError["BusinessLogicError"]
    end
    
    subgraph "Error Serialization"
        ErrorMarshaller["Error Marshaller"]
        StackTracePreservation["Stack Trace Preservation"]
        ContextSerialization["Context Serialization"]
    end
    
    subgraph "Error Recovery"
        AutoRetry["Automatic Retry"]
        FallbackResponse["Fallback Response"]
        CircuitBreaker["Circuit Breaker"]
    end
    
    subgraph "Error Reporting"
        StructuredLogging["Structured Logging"]
        ErrorMetrics["Error Metrics"]
        AlertSystem["Alert System"]
    end
    
    ValidationError --> ErrorMarshaller
    DatabaseError --> StackTracePreservation
    NetworkError --> ContextSerialization
    AuthError --> ErrorMarshaller
    BusinessError --> StackTracePreservation
    
    ErrorMarshaller --> AutoRetry
    StackTracePreservation --> FallbackResponse
    ContextSerialization --> CircuitBreaker
    
    AutoRetry --> StructuredLogging
    FallbackResponse --> ErrorMetrics
    CircuitBreaker --> AlertSystem
    
    classDef errortype fill:#ffebee
    classDef serialization fill:#f3e5f5
    classDef recovery fill:#fff3e0
    classDef reporting fill:#e8f5e9
    
    class ValidationError,DatabaseError,NetworkError,AuthError,BusinessError errortype
    class ErrorMarshaller,StackTracePreservation,ContextSerialization serialization
    class AutoRetry,FallbackResponse,CircuitBreaker recovery
    class StructuredLogging,ErrorMetrics,AlertSystem reporting
```

## Chapter 19: サブスクリプション システム (Subscription System)

### 19.1 リアルタイム通知アーキテクチャ (Real-time Notification Architecture)

```mermaid
graph TB
    subgraph "Publisher Layer"
        DatabaseTriggers["Database Triggers"]
        ChangeDetection["Change Detection"]
        EventAggregation["Event Aggregation"]
    end
    
    subgraph "Message Broker"
        EventBus["Event Bus"]
        TopicRouting["Topic Routing"]
        MessageFiltering["Message Filtering"]
    end
    
    subgraph "Subscription Management"
        SubscriptionRegistry["Subscription Registry"]
        WeakRefManager["WeakRef Manager"]
        MemoryLeakPrevention["Memory Leak Prevention"]
    end
    
    subgraph "Subscriber Layer"
        ReactHooks["React Hooks"]
        ComponentUpdates["Component Updates"]
        BatchedUpdates["Batched Updates"]
    end
    
    DatabaseTriggers --> EventBus
    ChangeDetection --> TopicRouting
    EventAggregation --> MessageFiltering
    
    EventBus --> SubscriptionRegistry
    TopicRouting --> WeakRefManager
    MessageFiltering --> MemoryLeakPrevention
    
    SubscriptionRegistry --> ReactHooks
    WeakRefManager --> ComponentUpdates
    MemoryLeakPrevention --> BatchedUpdates
    
    classDef publisher fill:#e1f5fe
    classDef broker fill:#f3e5f5
    classDef subscription fill:#fff3e0
    classDef subscriber fill:#e8f5e9
    
    class DatabaseTriggers,ChangeDetection,EventAggregation publisher
    class EventBus,TopicRouting,MessageFiltering broker
    class SubscriptionRegistry,WeakRefManager,MemoryLeakPrevention subscription
    class ReactHooks,ComponentUpdates,BatchedUpdates subscriber
```

### 19.2 サブスクリプションタイプ (Subscription Types)

| サブスクリプション | 対象 | 粒度 | パフォーマンス | 用途 |
|-------------------|------|------|----------------|------|
| **ノードサブスクリプション** | 単一ノード変更 | ノードレベル | 高速 | フォーム編集、詳細表示 |
| **ツリーサブスクリプション** | ツリー構造変更 | ツリーレベル | 中速 | ツリービュー、ナビゲーション |
| **エンティティサブスクリプション** | エンティティ変更 | エンティティレベル | 高速 | プラグイン固有UI |
| **バルクサブスクリプション** | 複数ノード変更 | バッチレベル | 低速 | テーブルビュー、一括操作 |
| **検索サブスクリプション** | 検索結果変更 | クエリレベル | 中速 | 動的フィルター、検索UI |

### 19.3 サブスクリプション最適化 (Subscription Optimization)

```typescript
// 効率的なサブスクリプション実装
class SubscriptionManager {
  private subscriptions = new Map<string, Set<WeakRef<Subscriber>>>();
  private batchedUpdates = new Map<string, Set<ChangeEvent>>();
  private batchTimeout: number | null = null;

  subscribe<T>(
    topic: string, 
    subscriber: Subscriber<T>,
    filter?: (event: ChangeEvent<T>) => boolean
  ): () => void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    
    const weakRef = new WeakRef(subscriber);
    this.subscriptions.get(topic)!.add(weakRef);
    
    // Cleanup function
    return () => {
      this.subscriptions.get(topic)?.delete(weakRef);
    };
  }

  notify<T>(topic: string, event: ChangeEvent<T>): void {
    // Batch updates for performance
    if (!this.batchedUpdates.has(topic)) {
      this.batchedUpdates.set(topic, new Set());
    }
    
    this.batchedUpdates.get(topic)!.add(event);
    
    if (this.batchTimeout === null) {
      this.batchTimeout = setTimeout(() => this.flushBatch(), 16); // 60fps
    }
  }

  private flushBatch(): void {
    for (const [topic, events] of this.batchedUpdates) {
      const subscribers = this.subscriptions.get(topic);
      if (!subscribers) continue;

      // Clean up dead references
      for (const weakRef of subscribers) {
        const subscriber = weakRef.deref();
        if (subscriber) {
          subscriber.onUpdate(Array.from(events));
        } else {
          subscribers.delete(weakRef);
        }
      }
    }
    
    this.batchedUpdates.clear();
    this.batchTimeout = null;
  }
}
```

## Chapter 20: プラグインAPI拡張 (Plugin API Extension)

### 20.1 プラグイン登録システム (Plugin Registration System)

```mermaid
graph TB
    subgraph "Plugin Definition"
        PluginMetadata["Plugin Metadata"]
        NodeTypeDefinition["Node Type Definition"]
        EntitySchema["Entity Schema"]
        UIComponents["UI Components"]
    end
    
    subgraph "Registration Process"
        ValidationStep["Validation Step"]
        SchemaRegistration["Schema Registration"]
        HandlerRegistration["Handler Registration"]
        UIRegistration["UI Registration"]
    end
    
    subgraph "Runtime Integration"
        DynamicImport["Dynamic Import"]
        TypeRegistration["Type Registration"]
        ComponentMount["Component Mount"]
        EventBinding["Event Binding"]
    end
    
    subgraph "Plugin Management"
        PluginRegistry["Plugin Registry"]
        DependencyResolution["Dependency Resolution"]
        VersionManagement["Version Management"]
        ConflictResolution["Conflict Resolution"]
    end
    
    PluginMetadata --> ValidationStep
    NodeTypeDefinition --> SchemaRegistration
    EntitySchema --> HandlerRegistration
    UIComponents --> UIRegistration
    
    ValidationStep --> DynamicImport
    SchemaRegistration --> TypeRegistration
    HandlerRegistration --> ComponentMount
    UIRegistration --> EventBinding
    
    DynamicImport --> PluginRegistry
    TypeRegistration --> DependencyResolution
    ComponentMount --> VersionManagement
    EventBinding --> ConflictResolution
    
    classDef definition fill:#e1f5fe
    classDef registration fill:#f3e5f5
    classDef integration fill:#fff3e0
    classDef management fill:#e8f5e9
    
    class PluginMetadata,NodeTypeDefinition,EntitySchema,UIComponents definition
    class ValidationStep,SchemaRegistration,HandlerRegistration,UIRegistration registration
    class DynamicImport,TypeRegistration,ComponentMount,EventBinding integration
    class PluginRegistry,DependencyResolution,VersionManagement,ConflictResolution management
```

### 20.2 プラグインAPI契約 (Plugin API Contract)

```typescript
// プラグインインターフェース定義
interface IPlugin {
  readonly metadata: PluginMetadata;
  readonly nodeType: string;
  readonly version: string;
  readonly dependencies?: PluginDependency[];
  
  // ライフサイクルフック
  onInstall?(context: PluginContext): Promise<void>;
  onUninstall?(context: PluginContext): Promise<void>;
  onActivate?(context: PluginContext): Promise<void>;
  onDeactivate?(context: PluginContext): Promise<void>;
  
  // 設定管理
  getDefaultConfig?(): PluginConfig;
  validateConfig?(config: PluginConfig): ValidationResult;
  
  // UI拡張
  getDialogComponent?(): React.ComponentType<DialogProps>;
  getPanelComponent?(): React.ComponentType<PanelProps>;
  getIconComponent?(): React.ComponentType<IconProps>;
}

interface IEntityHandler<TEntity, TSubEntity = never, TWorkingCopy = TEntity> {
  // CRUD操作
  create(nodeId: NodeId, data: Partial<TEntity>): Promise<Result<EntityId>>;
  read(entityId: EntityId): Promise<Result<TEntity>>;
  update(entityId: EntityId, data: Partial<TEntity>): Promise<Result<void>>;
  delete(entityId: EntityId): Promise<Result<void>>;
  
  // Working Copy操作
  createWorkingCopy(entityId: EntityId): Promise<Result<TWorkingCopy>>;
  updateWorkingCopy(workingCopyId: string, data: Partial<TWorkingCopy>): Promise<Result<void>>;
  commitWorkingCopy(workingCopyId: string): Promise<Result<EntityId>>;
  discardWorkingCopy(workingCopyId: string): Promise<Result<void>>;
  
  // サブエンティティ管理（オプショナル）
  createSubEntity?(parentId: EntityId, data: Partial<TSubEntity>): Promise<Result<EntityId>>;
  getSubEntities?(parentId: EntityId): Promise<Result<TSubEntity[]>>;
  
  // ライフサイクルフック
  beforeCreate?(data: Partial<TEntity>, context: OperationContext): Promise<void>;
  afterCreate?(entity: TEntity, context: OperationContext): Promise<void>;
  beforeUpdate?(entityId: EntityId, data: Partial<TEntity>, context: OperationContext): Promise<void>;
  afterUpdate?(entity: TEntity, context: OperationContext): Promise<void>;
  beforeDelete?(entityId: EntityId, context: OperationContext): Promise<void>;
  afterDelete?(entityId: EntityId, context: OperationContext): Promise<void>;
}

// プラグイン登録の型安全な実装
class NodeTypeRegistry {
  private static instance: NodeTypeRegistry;
  private registrations = new Map<string, NodeTypeRegistration>();
  
  register<TEntity, TSubEntity = never, TWorkingCopy = TEntity>(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    // バリデーション
    this.validateDefinition(definition);
    
    // 依存関係チェック
    this.resolveDependencies(definition);
    
    // 登録実行
    this.registrations.set(definition.nodeType, {
      definition,
      handler: definition.entityHandler,
      schema: definition.database.schema,
      version: definition.database.version,
      ui: definition.ui,
      lifecycle: definition.lifecycle,
    });
    
    // データベーススキーマ更新
    this.updateDatabaseSchema(definition);
    
    // UI コンポーネント登録
    this.registerUIComponents(definition);
  }
  
  private validateDefinition<T, S, W>(
    definition: NodeTypeDefinition<T, S, W>
  ): void {
    if (!definition.nodeType || typeof definition.nodeType !== 'string') {
      throw new Error('Invalid node type');
    }
    
    if (this.registrations.has(definition.nodeType)) {
      throw new Error(`Node type '${definition.nodeType}' already registered`);
    }
    
    // その他のバリデーション...
  }
}
```

### 20.3 プラグイン通信プロトコル (Plugin Communication Protocol)

| 通信タイプ | プロトコル | 用途 | セキュリティ |
|------------|------------|------|-------------|
| **Plugin-to-Core** | Direct API calls | コア機能アクセス | Type-safe interfaces |
| **Plugin-to-Plugin** | Event Bus | プラグイン間連携 | Namespace isolation |
| **Plugin-to-UI** | React Context | UI状態共有 | Component boundaries |
| **Plugin-to-Worker** | Comlink proxy | バックグラウンド処理 | RPC validation |
| **Plugin-to-External** | CORS Proxy | 外部API アクセス | JWT authentication |

```mermaid
graph LR
    subgraph "Plugin Ecosystem"
        PluginA["Plugin A"]
        PluginB["Plugin B"]
        PluginC["Plugin C"]
    end
    
    subgraph "Communication Channels"
        EventBus["Event Bus"]
        SharedContext["Shared Context"]
        APIProxy["API Proxy"]
    end
    
    subgraph "Core System"
        CoreAPI["Core API"]
        WorkerLayer["Worker Layer"]
        DatabaseLayer["Database Layer"]
    end
    
    subgraph "External Services"
        ExternalAPI["External APIs"]
        ThirdPartyService["3rd Party Services"]
    end
    
    PluginA --> EventBus
    PluginB --> SharedContext
    PluginC --> APIProxy
    
    EventBus --> CoreAPI
    SharedContext --> WorkerLayer
    APIProxy --> DatabaseLayer
    
    CoreAPI --> ExternalAPI
    WorkerLayer --> ThirdPartyService
    
    classDef plugin fill:#e1f5fe
    classDef communication fill:#f3e5f5
    classDef core fill:#fff3e0
    classDef external fill:#e8f5e9
    
    class PluginA,PluginB,PluginC plugin
    class EventBus,SharedContext,APIProxy communication
    class CoreAPI,WorkerLayer,DatabaseLayer core
    class ExternalAPI,ThirdPartyService external
```

## まとめ (Summary)

API層では、型安全で拡張可能な通信システムを構築しました：

- **Worker API**: Comlink RPCによる非同期・型安全な通信
- **サブスクリプション**: メモリ効率的なリアルタイム通知システム
- **プラグイン API**: 動的で型安全なプラグイン拡張機能

この設計により、フロントエンドとワーカー間の堅牢な通信と、プラグインによる機能拡張を実現しています。