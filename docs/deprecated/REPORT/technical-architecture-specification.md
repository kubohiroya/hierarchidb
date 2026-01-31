# HierarchiDB 技術アーキテクチャ仕様書

## はじめに

この技術仕様書では、HierarchiDBの内部アーキテクチャと実装詳細について、システムアーキテクト・開発者向けに包括的に説明します。本ドキュメントは以下のような方を対象としています：

**読むべき人**: システムアーキテクト、上級開発者、技術リーダー、システム全体の設計判断を行う方、パフォーマンス最適化を担当する方、BaseMap・Styler・Shape・Spreadsheet・Projectプラグインの深い技術理解が必要な開発者

**前提知識**: Web Worker、Comlink、TypeScript高度な型システム、Dexie.js/IndexedDB、React アーキテクチャパターン、RPC通信、データベース設計、パフォーマンス最適化

**読むタイミング**: システム全体の技術的理解が必要な際、アーキテクチャ設計の意思決定を行う際、技術的な問題解決やパフォーマンス分析を行う際に参照してください。本書は実装詳細レベルでの技術的判断に必要な情報を提供します。

本仕様書は、UML図とシーケンス図を用いてシステムの動作メカニズムを詳細に解説し、技術的な設計判断の根拠となる情報を提供します。

## 概要

本ドキュメントでは、HierarchiDBの内部アーキテクチャと動作メカニズムを、UML図を用いて詳細に説明します。

## 1. システム全体アーキテクチャ

### 1.1 システム構成図

```mermaid
graph TB
    subgraph "UI Layer"
        UI[React Components]
        UIClient[UI Client]
        Hooks[React Hooks]
    end
    
    subgraph "Communication Layer"
        Comlink[Comlink RPC]
        Proxy[Worker Proxy]
    end
    
    subgraph "Worker Layer"
        API[Worker API]
        Services[Services]
        Handlers[Entity Handlers]
        Registry[Node Registry]
    end
    
    subgraph "Data Layer"
        CoreDB[(CoreDB<br/>Persistent)]
        EphemeralDB[(EphemeralDB<br/>Temporary)]
    end
    
    subgraph "Plugin System"
        BaseMap[BaseMap Plugin]
        Styler[Styler Plugin]
        Shapes[Shapes Plugin]
    end
    
    UI --> UIClient
    UIClient --> Comlink
    Comlink --> API
    API --> Services
    Services --> Handlers
    Services --> Registry
    Handlers --> CoreDB
    Handlers --> EphemeralDB
    
    BaseMap --> Handlers
    Styler --> Handlers
    Shapes --> Handlers
```

### 1.2 レイヤー責務

| レイヤー | 責務 | 主要コンポーネント |
|---------|------|-------------------|
| UI Layer | ユーザーインターフェース、状態管理 | React, MUI, Context |
| Communication | UI-Worker間通信 | Comlink, Proxy |
| Worker Layer | ビジネスロジック、データ操作 | Services, Handlers |
| Data Layer | データ永続化 | IndexedDB, Dexie |
| Plugin System | 機能拡張 | Node Types, Handlers |

## 2. クラス図

### 2.1 EntityHandler階層構造

```mermaid
classDiagram
    class BaseEntityHandler {
        <<abstract>>
        #db: Dexie
        #tableName: string
        #draftTableName: string
        +createEntity(nodeId: NodeId, data?: Partial~T~): Promise~T~
        +getEntity(nodeId: NodeId): Promise~T | undefined~
        +updateEntity(nodeId: NodeId, data: Partial~T~): Promise~void~
        +deleteEntity(nodeId: NodeId): Promise~void~
        +createDraft(nodeId: NodeId): Promise~TDraft~
        +commitDraft(nodeId: NodeId, draft: TDraft): Promise~void~
        +discardDraft(nodeId: NodeId): Promise~void~
        #generateNodeId(): string
        #now(): number
        #log(message: string, data?: any): void
    }

    class PeerEntityHandler {
        <<abstract>>
        +ensureEntityExists(nodeId: NodeId): Promise~TEntity~
        +syncWithNode(nodeId: NodeId, nodeData?: Partial~any~): Promise~void~
        +onNodeCreated(nodeId: NodeId, nodeData: any): Promise~void~
        +onNodeUpdated(nodeId: NodeId, nodeData: any, oldNodeData?: any): Promise~void~
        +onNodeDeleted(nodeId: NodeId): Promise~void~
        #getDefaultEntityData(): Partial~TEntity~
        #extractEntityUpdatesFromNode(nodeData: Partial~any~): Partial~TEntity~
        #validateUniqueEntity(nodeId: NodeId): Promise~void~
    }

    class GroupEntityHandler {
        <<abstract>>
        +createBatch(nodeId: NodeId, items: Partial~TEntity~[]): Promise~TEntity[]~
        +getByParentNode(nodeId: NodeId): Promise~TEntity[]~
        +updateBatchByNode(nodeId: NodeId, updates: Partial~TEntity~[]): Promise~void~
        +deleteByParentNode(nodeId: NodeId): Promise~void~
        +reorderEntities(nodeId: NodeId, orderedIds: EntityId[]): Promise~void~
        +getCountByParentNode(nodeId: NodeId): Promise~number~
        +getByParentNodePaginated(nodeId: NodeId, offset: number, limit: number): Promise~Object~
        #getNextIndex(nodeId: NodeId): Promise~number~
        #validateGroupEntity(entity: Partial~TEntity~): void
    }

    class RelationalEntityHandler {
        <<abstract>>
        +addReference(entityId: EntityId, nodeId: NodeId): Promise~TEntity~
        +removeReference(entityId: EntityId, nodeId: NodeId): Promise~boolean~
        +getEntityById(entityId: EntityId): Promise~TEntity | undefined~
        +getReferencedEntities(nodeId: NodeId): Promise~TEntity[]~
        +removeAllReferences(nodeId: NodeId): Promise~EntityId[]~
        +updateEntityContent(entityId: EntityId, updates: Partial~TEntity~): Promise~void~
        +cleanupOrphanedEntities(): Promise~number~
        +getReferenceStats(): Promise~Object~
        #createSharedEntity(entityId: EntityId, nodeId: NodeId, data?: Partial~TEntity~): Promise~TEntity~
        #validateRelationalEntity(entity: Partial~TEntity~): void
    }

    class BaseMapEntityHandler {
        +changeMapStyle(nodeId: NodeId, style: MapStyle): Promise~void~
        +setBounds(nodeId: NodeId, bounds: Bounds): Promise~void~
        +clearTileCache(nodeId: NodeId): Promise~void~
        +findNearbyMaps(center: [number, number], radius: number): Promise~BaseMapEntity[]~
        #getDefaultEntityData(): Partial~BaseMapEntity~
        #deriveEntityDataFromNode(nodeData: any): Partial~BaseMapEntity~
    }

    class StylerEntityHandler {
        -tableMetadataManager: TableMetadataManager
        +createOrReuseTableMetadata(nodeId: NodeId, filename: string, fileContent: string, columns: string[], tableRows: any[][]): Promise~string~
        +getTableMetadata(nodeId: NodeId): Promise~TableMetadataEntity | undefined~
        +cleanupOrphanedTableMetadata(): Promise~number~
        #getDefaultEntityData(): Partial~StylerEntity~
    }

    BaseEntityHandler <|-- PeerEntityHandler
    BaseEntityHandler <|-- GroupEntityHandler
    BaseEntityHandler <|-- RelationalEntityHandler
    PeerEntityHandler <|-- BaseMapEntityHandler
    PeerEntityHandler <|-- StylerEntityHandler
```

### 2.2 エンティティ型システム

```mermaid
classDiagram
    class BaseEntity {
        <<interface>>
        +createdAt: Timestamp
        +updatedAt: Timestamp
        +version: number
    }

    class PeerEntity {
        <<interface>>
        +nodeId: NodeId
    }

    class GroupEntity {
        <<interface>>
        +id: EntityId
        +parentNodeId: NodeId
        +type: string
        +index?: number
    }

    class RelationalEntity {
        <<interface>>
        +id: EntityId
        +referenceCount: number
        +referencingNodeIds: NodeId[]
        +lastAccessedAt: Timestamp
    }

    class BaseMapEntity {
        +nodeId: NodeId
        +mapStyle: MapStyle
        +center: [number, number]
        +zoom: number
        +bearing: number
        +pitch: number
        +bounds?: Bounds
        +displayOptions?: DisplayOptions
    }

    class StylerEntity {
        +nodeId: NodeId
        +name: string
        +tableMetadataId?: string
        +filterRules: FilterRule[]
        +selectedKeyColumn: string
        +selectedValueColumns: string[]
        +stylerConfig: StylerConfig
    }

    class TableMetadataEntity {
        +id: EntityId
        +filename: string
        +contentHash: string
        +columns: string[]
        +tableRows: any[][]
        +columnStats: Record~string, any~
        +referenceCount: number
        +referencingNodeIds: NodeId[]
    }

    BaseEntity <|-- PeerEntity
    BaseEntity <|-- GroupEntity
    BaseEntity <|-- RelationalEntity
    PeerEntity <|-- BaseMapEntity
    PeerEntity <|-- StylerEntity
    RelationalEntity <|-- TableMetadataEntity
```

### 2.3 データベース構造

```mermaid
classDiagram
    class CoreDB {
        +trees: Table~TreeTypes, TreeId~
        +nodes: Table~TreeNode, NodeId~
        +rootStates: Table~TreeRootState, [TreeId, TreeRootNodeType]~
        +initialize(): Promise~void~
        +getTree(treeId: TreeId): Promise~TreeTypes | undefined~
        +getNode(nodeId: NodeId): Promise~TreeNode | undefined~
        +createNode(node: TreeNode): Promise~NodeId~
        +updateNode(node: TreeNode): Promise~void~
        +deleteNode(nodeId: NodeId): Promise~void~
        +getChildren(parentId: NodeId): Promise~TreeNode[]~
    }

    class EphemeralDB {
        +workingCopies: Table~DraftTypes, string~
        +views: Table~TreeViewState, string~
        +entityWorkingCopies: Table~EntiryDraftTypes, string~
        +initialize(): Promise~void~
        +getDraft(draftId: string): Promise~DraftTypes | undefined~
        +updateDraft(draft: DraftTypes): Promise~void~
        +discardDraft(draftId: string): Promise~void~
    }

    class DexieAdapter {
        <<generic>>
        -db: Dexie
        -tableName: string
        +create(data: T): Promise~T~
        +read(id: string): Promise~T | undefined~
        +update(id: string, changes: Partial~T~): Promise~void~
        +delete(id: string): Promise~void~
        +list(filter?: any): Promise~T[]~
        +count(filter?: any): Promise~number~
    }

    CoreDB --> DexieAdapter
    EphemeralDB --> DexieAdapter
```

## 3. シーケンス図

### 3.1 ノード作成シーケンス

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant Client as UI Client
    participant Worker as Worker API
    participant Service as TreeTypes Service
    participant Handler as Entity Handler
    participant CoreDB as CoreDB
    participant Registry as Node Registry
    
    UI->>Client: createNode(parentId, nodeType, data)
    Client->>Worker: createNode(parentId, nodeType, data)
    Worker->>Service: createNode(parentId, nodeType, data)
    
    Service->>Registry: getNodeTypeDefinition(nodeType)
    Registry-->>Service: nodeTypeDefinition
    
    Service->>Service: generateNodeId()
    Service->>Service: validateNodeData(data)
    
    Service->>CoreDB: createNode(newNode)
    CoreDB-->>Service: nodeId
    
    Service->>Handler: createEntity(nodeId, data)
    Handler->>CoreDB: table(entityTable).add(entity)
    CoreDB-->>Handler: entity
    Handler-->>Service: entity
    
    Service->>Registry: triggerLifecycleHook('afterCreate', nodeId, entity)
    Registry-->>Service: success
    
    Service-->>Worker: { nodeId, node, entity }
    Worker-->>Client: result
    Client-->>UI: result
    
    Note over CoreDB: Publishes change event
    CoreDB->>Client: nodeCreated event
    Client->>UI: update state
```

### 3.2 エンティティワーキングコピーシーケンス

```mermaid
sequenceDiagram
    participant UI as UI Dialog
    participant Client as UI Client
    participant Worker as Worker API
    participant WCManager as DraftTypes Manager
    participant EntityHandler as Entity Handler
    participant EphemeralDB as EphemeralDB
    participant CoreDB as CoreDB
    
    UI->>Client: openDialog(nodeId)
    Client->>Worker: createEntityDraft(nodeId, entityType)
    Worker->>EntityHandler: getEntity(nodeId)
    EntityHandler->>CoreDB: table(entityTable).get(nodeId)
    CoreDB-->>EntityHandler: entity
    EntityHandler-->>Worker: entity
    
    Worker->>WCManager: createPeerEntityDraft(entity, sessionId)
    WCManager->>WCManager: generateDraftId()
    WCManager->>EphemeralDB: table('entityWorkingCopies').add(draft)
    EphemeralDB-->>WCManager: success
    WCManager-->>Worker: draft
    Worker-->>Client: draft
    Client-->>UI: draft
    
    loop Editing
        UI->>Client: updateDraft(draftId, changes)
        Client->>Worker: updateEntityDraft(draftId, changes)
        Worker->>WCManager: updatePeerEntityDraft(draftId, changes)
        WCManager->>EphemeralDB: table('entityWorkingCopies').put(updatedDraft)
        EphemeralDB-->>WCManager: success
        WCManager->>WCManager: updateSessionActivity(sessionId)
        WCManager-->>Worker: success
        Worker-->>Client: success
        Client-->>UI: success
    end
    
    alt Commit Changes
        UI->>Client: commitDraft(draftId)
        Client->>Worker: commitEntityDraft(draftId)
        Worker->>WCManager: commitPeerEntityDraft(draftId, validator)
        WCManager->>WCManager: validateDraft(draft)
        WCManager->>EntityHandler: updateEntity(nodeId, entityData)
        EntityHandler->>CoreDB: table(entityTable).put(entity)
        CoreDB-->>EntityHandler: success
        EntityHandler-->>WCManager: committedEntity
        WCManager->>EphemeralDB: table('entityWorkingCopies').delete(draftId)
        EphemeralDB-->>WCManager: success
        WCManager-->>Worker: committedEntity
        Worker-->>Client: committedEntity
        Client-->>UI: success
    else Discard Changes
        UI->>Client: discardDraft(draftId)
        Client->>Worker: discardEntityDraft(draftId)
        Worker->>WCManager: discardEntityDraft(draftId)
        WCManager->>EphemeralDB: table('entityWorkingCopies').delete(draftId)
        EphemeralDB-->>WCManager: success
        WCManager-->>Worker: success
        Worker-->>Client: success
        Client-->>UI: success
    end
```

### 3.3 RelationalEntity参照管理シーケンス

```mermaid
sequenceDiagram
    participant SM as Styler Handler
    participant TM as TableMetadata Manager
    participant RelHandler as Relational Handler
    participant CoreDB as CoreDB
    
    SM->>SM: createEntity(nodeId, {tableMetadataId})
    SM->>TM: addReference(tableMetadataId, nodeId)
    TM->>RelHandler: addReference(tableMetadataId, nodeId)
    
    RelHandler->>CoreDB: table('tableMetadataEntities').get(tableMetadataId)
    CoreDB-->>RelHandler: entity | undefined
    
    alt Entity Exists
        RelHandler->>RelHandler: entity.referencingNodeIds.push(nodeId)
        RelHandler->>RelHandler: entity.referenceCount++
        RelHandler->>CoreDB: table('tableMetadataEntities').put(entity)
        CoreDB-->>RelHandler: success
    else Entity Not Exists
        RelHandler->>RelHandler: createSharedEntity(tableMetadataId, nodeId, data)
        RelHandler->>CoreDB: table('tableMetadataEntities').add(newEntity)
        CoreDB-->>RelHandler: newEntity
    end
    
    RelHandler-->>TM: updatedEntity
    TM-->>SM: updatedEntity
    
    Note over SM,CoreDB: Later: Delete Styler
    SM->>SM: deleteEntity(nodeId)
    SM->>TM: removeReference(tableMetadataId, nodeId)
    TM->>RelHandler: removeReference(tableMetadataId, nodeId)
    
    RelHandler->>CoreDB: table('tableMetadataEntities').get(tableMetadataId)
    CoreDB-->>RelHandler: entity
    
    RelHandler->>RelHandler: entity.referencingNodeIds.splice(indexOf(nodeId), 1)
    RelHandler->>RelHandler: entity.referenceCount--
    
    alt Reference Count > 0
        RelHandler->>CoreDB: table('tableMetadataEntities').put(entity)
        CoreDB-->>RelHandler: success
    else Reference Count = 0
        RelHandler->>CoreDB: table('tableMetadataEntities').delete(tableMetadataId)
        CoreDB-->>RelHandler: success
        Note over RelHandler: Entity auto-deleted
    end
    
    RelHandler-->>TM: wasDeleted: boolean
    TM-->>SM: wasDeleted: boolean
```

## 4. コミュニケーション図

### 4.1 プラグインシステム相互作用

```mermaid
graph LR
    subgraph "Plugin Registration"
        PluginDef[Plugin Definition]
        Registry[Node Registry]
        HandlerFactory[Handler Factory]
    end
    
    subgraph "Runtime Execution"
        NodeOps[Node Operations]
        EntityHandler[Entity Handler]
        DB[Database]
    end
    
    subgraph "UI Integration"
        DialogComponent[Dialog Component]
        UIHooks[UI Hooks]
        WorkerClient[Worker Client]
    end
    
    PluginDef -->|register| Registry
    Registry -->|create| HandlerFactory
    HandlerFactory -->|instantiate| EntityHandler
    
    NodeOps -->|delegate| EntityHandler
    EntityHandler -->|persist| DB
    
    DialogComponent -->|communicate| WorkerClient
    WorkerClient -->|rpc| NodeOps
    UIHooks -->|subscribe| WorkerClient
    
    Registry -.->|metadata| DialogComponent
    EntityHandler -.->|events| UIHooks
```

### 4.2 データフロー

```mermaid
graph TB
    subgraph "UI Layer"
        A[User Action]
        B[React State]
        C[UI Hooks]
    end
    
    subgraph "Communication"
        D[Comlink Proxy]
        E[RPC Call]
    end
    
    subgraph "Worker Layer"
        F[Worker API]
        G[Command Processor]
        H[Entity Handler]
    end
    
    subgraph "Data Layer"
        I[CoreDB Transaction]
        J[EphemeralDB Session]
        K[Change Events]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    H --> J
    I --> K
    J --> K
    K -.-> D
    D -.-> C
    C -.-> B
```

## 5. 状態遷移図

### 5.1 エンティティワーキングコピーの状態遷移

```mermaid
stateDiagram-v2
    [*] --> Created : createDraft()
    
    Created --> Editing : updateDraft()
    Created --> Discarded : discardDraft()
    
    Editing --> Editing : updateDraft()
    Editing --> Validating : commitDraft()
    Editing --> Discarded : discardDraft()
    Editing --> AutoSaved : autoSave() [if enabled]
    
    AutoSaved --> Editing : updateDraft()
    AutoSaved --> Validating : commitDraft()
    AutoSaved --> Discarded : discardDraft()
    
    Validating --> ValidationFailed : validation error
    Validating --> Committing : validation success
    
    ValidationFailed --> Editing : fix errors
    ValidationFailed --> Discarded : discardDraft()
    
    Committing --> Committed : commit success
    Committing --> CommitFailed : commit error
    
    CommitFailed --> Editing : retry
    CommitFailed --> Discarded : discardDraft()
    
    Committed --> [*]
    Discarded --> [*]
    
    note right of Created
        Initial state after
        working copy creation
    end note
    
    note right of Editing
        isDirty = true
        User making changes
    end note
    
    note right of AutoSaved
        Temporary save
        isDirty = false
    end note
    
    note right of Validating
        Business rule validation
        in progress
    end note
```

### 5.2 RelationalEntity参照カウントの状態遷移

```mermaid
stateDiagram-v2
    [*] --> NonExistent
    
    NonExistent --> Created : addReference() [count=1]
    
    Created --> Referenced : addReference() [count>1]
    Created --> NonExistent : removeReference() [count=0]
    
    Referenced --> Referenced : addReference() [count++]
    Referenced --> Referenced : removeReference() [count>1]
    Referenced --> Created : removeReference() [count=1]
    
    state Created {
        [*] --> SingleRef
        SingleRef --> LastAccessed : touchEntity()
        LastAccessed --> SingleRef : timeout
    }
    
    state Referenced {
        [*] --> MultiRef
        MultiRef --> LastAccessed : touchEntity()
        LastAccessed --> MultiRef : timeout
    }
    
    note right of NonExistent
        Entity does not exist
        referenceCount = 0
    end note
    
    note right of Created
        Entity exists with
        single reference
        referenceCount = 1
    end note
    
    note right of Referenced
        Entity exists with
        multiple references
        referenceCount > 1
    end note
```

### 5.3 セッション状態遷移

```mermaid
stateDiagram-v2
    [*] --> SessionStarted : createSession()
    
    SessionStarted --> Active : addDraft()
    SessionStarted --> Ended : endSession()
    
    Active --> Active : addDraft()
    Active --> Active : updateActivity()
    Active --> Inactive : timeout
    Active --> Committing : endSession(commit=true)
    Active --> Discarding : endSession(commit=false)
    
    Inactive --> Active : updateActivity()
    Inactive --> Cleanup : cleanup timeout
    
    Committing --> CommitSuccess : all commits succeed
    Committing --> CommitFailed : any commit fails
    
    CommitSuccess --> Ended
    CommitFailed --> Active : retry
    
    Discarding --> Ended : all discarded
    
    Cleanup --> Ended : force cleanup
    Ended --> [*]
    
    note right of SessionStarted
        Empty session
        draftIds = []
    end note
    
    note right of Active
        Has working copies
        lastActivityAt updated
    end note
    
    note right of Inactive
        No activity for
        configured timeout
    end note
```

## 6. アクティビティ図

### 6.1 プラグイン登録プロセス

```mermaid
flowchart TD
    Start([Start Plugin Registration])
    
    LoadDef[Load Plugin Definition]
    ValidateSchema{Validate Schema?}
    
    CheckNodeType{Node Type Exists?}
    RegisterNodeType[Register Node Type]
    
    CreateTables{Database Tables Exist?}
    CreateDBTables[Create Database Tables]
    
    InstantiateHandler[Instantiate Entity Handler]
    ValidateHandler{Handler Valid?}
    
    RegisterLifecycle[Register Lifecycle Hooks]
    RegisterUIComponents[Register UI Components]
    
    AddToRegistry[Add to Node Registry]
    Complete([Registration Complete])
    
    Error([Registration Failed])
    
    Start --> LoadDef
    LoadDef --> ValidateSchema
    ValidateSchema -->|Valid| CheckNodeType
    ValidateSchema -->|Invalid| Error
    
    CheckNodeType -->|Not Exists| RegisterNodeType
    CheckNodeType -->|Exists| Error
    RegisterNodeType --> CreateTables
    
    CreateTables -->|Not Exist| CreateDBTables
    CreateTables -->|Exist| InstantiateHandler
    CreateDBTables --> InstantiateHandler
    
    InstantiateHandler --> ValidateHandler
    ValidateHandler -->|Valid| RegisterLifecycle
    ValidateHandler -->|Invalid| Error
    
    RegisterLifecycle --> RegisterUIComponents
    RegisterUIComponents --> AddToRegistry
    AddToRegistry --> Complete
```

### 6.2 複雑なエンティティ操作フロー

```mermaid
flowchart TD
    Start([Start Complex Operation])
    
    CreateSession[Create Working Copy Session]
    LoadEntities[Load Related EntityTypes]
    
    subgraph "Working Copy Creation"
        CreatePeerWC[Create Peer Entity Working Copy]
        CreateGroupWCs[Create Group Entity Working Copies]
        CreateRelWCs[Create Relational Entity Working Copies]
    end
    
    subgraph "Editing Phase"
        UpdatePeer[Update Peer Entity]
        BatchUpdateGroup[Batch Update Group EntityTypes]
        UpdateReferences[Update Relational References]
        ValidateChanges{Validate Changes?}
        ShowValidationErrors[Show Validation Errors]
    end
    
    subgraph "Commit Phase"
        StartCommit[Start Commit Transaction]
        CommitPeer[Commit Peer Entity]
        CommitGroups[Commit Group EntityTypes]
        UpdateRelReferences[Update Relational References]
        CleanupOrphans[Cleanup Orphaned Relations]
        CommitTransaction[Commit Transaction]
    end
    
    EndSession[End Session]
    Complete([Operation Complete])
    Rollback[Rollback Changes]
    Error([Operation Failed])
    
    Start --> CreateSession
    CreateSession --> LoadEntities
    LoadEntities --> CreatePeerWC
    CreatePeerWC --> CreateGroupWCs
    CreateGroupWCs --> CreateRelWCs
    
    CreateRelWCs --> UpdatePeer
    UpdatePeer --> BatchUpdateGroup
    BatchUpdateGroup --> UpdateReferences
    UpdateReferences --> ValidateChanges
    
    ValidateChanges -->|Invalid| ShowValidationErrors
    ShowValidationErrors --> UpdatePeer
    ValidateChanges -->|Valid| StartCommit
    
    StartCommit --> CommitPeer
    CommitPeer --> CommitGroups
    CommitGroups --> UpdateRelReferences
    UpdateRelReferences --> CleanupOrphans
    CleanupOrphans --> CommitTransaction
    
    CommitTransaction -->|Success| EndSession
    CommitTransaction -->|Failed| Rollback
    
    EndSession --> Complete
    Rollback --> Error
```

## 7. パッケージ図

### 7.1 全体パッケージ構成

```mermaid
graph TB
    subgraph "Application Layer"
        App[app]
    end
    
    subgraph "UI Packages"
        UICore[ui-core]
        UIClient[ui-client]
        UIAuth[ui-auth]
        UIRouting[ui-routing]
        UIDialog[ui-dialog]
        UITreeconsole[ui-treeconsole/*]
        UIMonitoring[ui-monitoring]
    end
    
    subgraph "Business Layer"
        API[api]
        Worker[worker]
    end
    
    subgraph "Core Layer"
        Core[core]
    end
    
    subgraph "Plugin Layer"
        BaseMap[plugin-basemap]
        Styler[plugin-styler]
        Shapes[plugin-shapes]
        Folder[plugin-folder]
    end
    
    subgraph "Backend Layer"
        BFF[bff]
        CorsProxy[cors-proxy]
    end
    
    App --> UICore
    App --> UIClient
    App --> UIAuth
    App --> UIRouting
    App --> UIDialog
    
    UICore --> Core
    UIClient --> API
    UIClient --> Worker
    
    Worker --> Core
    API --> Core
    
    BaseMap --> Worker
    BaseMap --> Core
    Styler --> Worker
    Styler --> Core
    Shapes --> Worker
    Shapes --> Core
    
    App -.-> BFF
    App -.-> CorsProxy
```

### 7.2 依存関係詳細

```mermaid
graph LR
    subgraph "Dependency Layers"
        L1[Layer 1: Core Types]
        L2[Layer 2: API Contracts]
        L3[Layer 3: Business Logic]
        L4[Layer 4: UI Components]
        L5[Layer 5: Application]
    end
    
    subgraph "Core (L1)"
        CoreTypes[types, utils, constants]
    end
    
    subgraph "API (L2)"
        APIContracts[Comlink interfaces]
    end
    
    subgraph "Worker (L3)"
        Services[Services]
        Handlers[Entity Handlers]
        Database[Database Layer]
    end
    
    subgraph "UI (L4)"
        Components[React Components]
        Hooks[Custom Hooks]
        Contexts[React Contexts]
    end
    
    subgraph "Plugins (L3)"
        PluginHandlers[Plugin Handlers]
        PluginTypes[Plugin Types]
        PluginUI[Plugin UI]
    end
    
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
    
    CoreTypes -.-> APIContracts
    APIContracts -.-> Services
    APIContracts -.-> Components
    
    Services --> Handlers
    Handlers --> Database
    
    PluginTypes --> CoreTypes
    PluginHandlers --> Handlers
    PluginUI --> Components
```

## 8. 配置図

### 8.1 ランタイム配置

```mermaid
graph TB
    subgraph "Browser Environment"
        subgraph "Main Thread"
            UIComponents[UI Components]
            UIState[React State]
            ComlinkProxy[Comlink Proxy]
        end
        
        subgraph "Web Worker Thread"
            WorkerAPI[Worker API]
            BusinessLogic[Business Logic]
            EntityHandlers[Entity Handlers]
        end
        
        subgraph "IndexedDB"
            CoreDatabase[(Core Database)]
            EphemeralDatabase[(Ephemeral Database)]
            PluginTables[(Plugin Tables)]
        end
    end
    
    subgraph "External Services"
        AuthProvider[Auth Provider]
        MapTileServer[Map Tile Server]
        CorsProxy[CORS Proxy]
    end
    
    UIComponents <--> UIState
    UIState <--> ComlinkProxy
    ComlinkProxy <--> WorkerAPI
    WorkerAPI <--> BusinessLogic
    BusinessLogic <--> EntityHandlers
    EntityHandlers <--> CoreDatabase
    EntityHandlers <--> EphemeralDatabase
    EntityHandlers <--> PluginTables
    
    UIComponents -.-> AuthProvider
    UIComponents -.-> MapTileServer
    UIComponents -.-> CorsProxy
```

### 8.2 開発時配置

```mermaid
graph TB
    subgraph "Development Environment"
        subgraph "Source Code"
            TypeScript[TypeScript Source]
            ReactComponents[React Components]
            WorkerSource[Worker Source]
        end
        
        subgraph "Build Tools"
            Vite[Vite Bundler]
            TypeChecker[TypeScript Compiler]
            ESLint[ESLint]
            Vitest[Vitest]
        end
        
        subgraph "Runtime"
            DevServer[Vite Dev Server]
            HMR[Hot Module Replacement]
            Browser[Browser]
        end
    end
    
    TypeScript --> TypeChecker
    ReactComponents --> Vite
    WorkerSource --> Vite
    
    TypeChecker --> ESLint
    ESLint --> Vitest
    Vitest --> DevServer
    
    DevServer --> HMR
    HMR --> Browser
    Browser -.-> DevServer
```

## まとめ

本技術仕様書では、HierarchiDBの内部アーキテクチャを以下の観点から詳細に説明しました：

### 📊 提供した図表
1. **システム構成図** - 全体アーキテクチャの理解
2. **クラス図** - EntityHandler階層とエンティティ型システム
3. **シーケンス図** - 主要な操作フローの理解
4. **コミュニケーション図** - コンポーネント間の相互作用
5. **状態遷移図** - エンティティとセッションの状態管理
6. **アクティビティ図** - 複雑なビジネスプロセス
7. **パッケージ図** - コードベースの構造と依存関係
8. **配置図** - ランタイムと開発時の配置

### 🎯 アーキテクチャの特徴
- **4層分離**: UI、通信、ビジネスロジック、データの明確な分離
- **3分類エンティティシステム**: Peer/Group/Relationalの特性に応じた最適化
- **型安全性**: Branded Typeによる実行時エラーの防止
- **プラグインシステム**: 標準化された拡張機能
- **ワーキングコピー**: 安全な編集機能とセッション管理

この技術仕様書により、開発者はHierarchiDBの内部動作を深く理解し、効率的な開発とメンテナンスが可能になります。