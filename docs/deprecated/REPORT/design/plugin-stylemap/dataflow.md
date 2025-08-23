# plugin-stylemap データフロー図

## システム全体データフロー

### 🟢 hierarchidb 4層アーキテクチャでのデータフロー

```mermaid
flowchart TD
    %% UI Layer
    U[ユーザー] --> SUI[StyleMap UI Components]
    SUI --> SD[StyleMapDialog]
    SD --> SC[StyleMapConfiguration]
    SC --> SP[StyleMapPreview]
    
    %% Comlink RPC Layer
    SD -.->|Comlink RPC| WA[StyleMapWorkerAPI]
    SC -.->|Comlink RPC| WA
    SP -.->|Comlink RPC| WA
    
    %% Worker Layer
    WA --> SMS[StyleMapService]
    SMS --> SMDB[StyleMapDB]
    SMS --> SMFC[StyleMapFileCacheService]
    SMS --> SME[StyleMapEntityHandler]
    
    %% Database Layer
    SMDB --> CDB[(CoreDB)]
    SMDB --> EDB[(EphemeralDB)]
    SMFC --> CA[Cache API]
    
    %% External Integration
    SMS --> MGL[MapLibre GL JS]
    SMFC --> FS[File System]
    
    %% Data Entities
    CDB --> SMEntity[StyleMapEntity]
    CDB --> TMEntity[TableMetadataEntity] 
    CDB --> REntity[RowEntity]
    EDB --> WC[Working Copy]
    EDB --> PS[Preview State]
    
    classDef uiLayer fill:#e1f5fe
    classDef workerLayer fill:#f3e5f5
    classDef dbLayer fill:#e8f5e8
    classDef external fill:#fff3e0
    
    class U,SUI,SD,SC,SP uiLayer
    class WA,SMS,SMDB,SMFC,SME workerLayer
    class CDB,EDB,SMEntity,TMEntity,REntity,WC,PS dbLayer
    class MGL,FS,CA external
```

## 機能別データフロー

### 🟢 1. StyleMap作成フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as StyleMapDialog
    participant W as StyleMapWorkerAPI
    participant S as StyleMapService
    participant DB as StyleMapDB
    participant Cache as FileCacheService
    participant CoreDB as CoreDB
    participant EDB as EphemeralDB

    %% ファイルアップロード
    U->>UI: ファイル選択
    UI->>W: parseFile(file)
    W->>Cache: calculateSHA3Hash(file)
    Cache-->>W: contentHash
    
    alt キャッシュヒット
        W->>Cache: getCachedData(hash)
        Cache-->>W: cachedTableData
    else キャッシュミス
        W->>S: parseCSV(file)
        S-->>W: tableData
        W->>Cache: storeCache(hash, tableData)
    end
    
    W-->>UI: ParseResult{columns, rows, metadata}
    
    %% 作業コピー作成
    UI->>W: createWorkingCopy(parentId)
    W->>S: initializeStyleMapEntity()
    S->>EDB: saveWorkingCopy(entity)
    EDB-->>S: workingCopyId
    S-->>W: workingCopyId
    W-->>UI: workingCopyId

    %% カラーマッピング設定
    U->>UI: カラーマッピング設定変更
    UI->>W: updateStyleConfig(workingCopyId, config)
    W->>S: calculateColorMapping(config, data)
    S-->>W: mappedColors
    W->>EDB: updateWorkingCopy(workingCopyId, config)
    W-->>UI: previewData

    %% 保存処理
    U->>UI: 保存ボタンクリック
    UI->>W: commitStyleMap(workingCopyId)
    W->>S: commitWorkingCopy(workingCopyId)
    
    S->>DB: beginTransaction()
    S->>CoreDB: saveStyleMapEntity(entity)
    S->>CoreDB: saveTableMetadata(tableMetadata)
    S->>CoreDB: bulkSaveRows(rows)
    S->>EDB: deleteWorkingCopy(workingCopyId)
    S->>DB: commitTransaction()
    
    S-->>W: success
    W-->>UI: success
    UI-->>U: 保存完了通知
```

### 🟢 2. StyleMap編集フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as StyleMapDialog
    participant W as StyleMapWorkerAPI
    participant S as StyleMapService
    participant CoreDB as CoreDB
    participant EDB as EphemeralDB

    %% 既存データ読み込み
    U->>UI: 編集モード開始
    UI->>W: loadStyleMap(nodeId)
    W->>S: getStyleMapEntity(nodeId)
    S->>CoreDB: getEntity(nodeId)
    CoreDB-->>S: StyleMapEntity
    S->>CoreDB: getTableMetadata(tableId)
    CoreDB-->>S: TableMetadataEntity
    S->>CoreDB: getRows(tableId)
    CoreDB-->>S: RowEntity[]
    
    %% 作業コピー作成
    S->>EDB: createWorkingCopy(entity)
    EDB-->>S: workingCopyId
    S-->>W: LoadedData{entity, table, rows, workingCopyId}
    W-->>UI: LoadedData

    %% 編集処理
    loop 設定変更
        U->>UI: 設定変更
        UI->>W: updateWorkingCopy(workingCopyId, changes)
        W->>EDB: updateWorkingCopy(workingCopyId, changes)
        W->>S: calculatePreview(changes, data)
        S-->>W: previewResult
        W-->>UI: リアルタイムプレビュー更新
    end

    %% コミット/キャンセル
    alt 保存
        U->>UI: 保存
        UI->>W: commitChanges(workingCopyId)
        W->>S: commitWorkingCopy(workingCopyId)
        S->>CoreDB: updateEntity(entity)
        S->>EDB: deleteWorkingCopy(workingCopyId)
    else キャンセル
        U->>UI: キャンセル
        UI->>W: discardChanges(workingCopyId)
        W->>EDB: deleteWorkingCopy(workingCopyId)
    end
```

### 🟢 3. リアルタイムプレビューフロー

```mermaid
flowchart LR
    %% Input Events
    UI[User Input] --> D[Debounce 300ms]
    D --> VC[Value Change]
    
    %% State Management
    VC --> UC[Update Config]
    UC --> CP[Calculate Preview]
    
    %% Worker Processing
    CP -.->|Comlink| WP[Worker Processing]
    WP --> CM[Color Mapping]
    CM --> SP[Style Properties]
    SP --> MP[MapLibre Properties]
    
    %% PreviewStep Rendering
    MP -.->|RPC Response| PR[Preview Rendering]
    PR --> PC[Preview Component]
    PC --> VU[Visual Update]
    
    %% Performance Optimization
    UC --> MC[Memo Cache]
    MC -.->|Cache Hit| PR
    
    %% Data Sources
    WC[(Working Copy)] --> CP
    RD[(Row Data)] --> CM
    
    classDef input fill:#e3f2fd
    classDef processing fill:#f3e5f5
    classDef rendering fill:#e8f5e8
    classDef data fill:#fff3e0
    
    class UI,D,VC input
    class UC,CP,WP,CM,SP,MP processing
    class PR,PC,VU rendering
    class WC,RD,MC data
```

## データ永続化フロー

### 🟢 4. データベース操作フロー

```mermaid
flowchart TD
    %% Data Input
    FD[File Data] --> SHA[SHA3 Hash]
    SHA --> HC{Hash Check}
    
    %% Deduplication Logic
    HC -->|Exists| RC[Reference Count++]
    HC -->|New| PS[Parse & Store]
    
    %% Storage Layers
    PS --> TME[TableMetadataEntity]
    PS --> RE[RowEntity]
    TME --> CDB[(CoreDB)]
    RE --> CDB
    
    %% StyleMap Entity
    SMC[StyleMap Config] --> SME[StyleMapEntity]
    SME --> CDB
    SME -.->|Reference| TME
    
    %% Working Copy Management
    SME --> WC[Working Copy]
    WC --> EDB[(EphemeralDB)]
    
    %% Cache Management
    FD --> FC[File Cache]
    FC --> CA[Cache API]
    
    %% Reference Management
    RC --> RCU[Reference Count Update]
    RCU --> TME
    
    classDef input fill:#e3f2fd
    classDef entity fill:#f3e5f5
    classDef storage fill:#e8f5e8
    classDef cache fill:#fff3e0
    
    class FD,SMC input
    class TME,RE,SME,WC entity
    class CDB,EDB storage
    class SHA,HC,PS,FC,CA,RC,RCU cache
```

### 🟢 5. Working Copy & Undo/Redo フロー

```mermaid
stateDiagram-v2
    [*] --> Original: Load from CoreDB
    Original --> WorkingCopy: Create Working Copy
    
    state WorkingCopy {
        [*] --> Clean
        Clean --> Dirty: User Edit
        Dirty --> Clean: Auto Save to EphemeralDB
        
        state UndoRedoBuffer {
            [*] --> Empty
            Empty --> HasHistory: Record Change
            HasHistory --> Empty: Clear Buffer
            HasHistory --> HasHistory: Add/Remove Command
        }
        
        Dirty --> UndoRedoBuffer: Record Command
        UndoRedoBuffer --> Dirty: Undo/Redo
    }
    
    WorkingCopy --> Committed: Commit Changes
    WorkingCopy --> Discarded: Cancel/Discard
    
    Committed --> [*]: Save to CoreDB & Cleanup
    Discarded --> [*]: Delete Working Copy
```

## エラーハンドリングフロー

### 🟡 6. エラー処理・回復フロー

```mermaid
flowchart TD
    %% Error Sources
    FE[File Error] --> EH[Error Handler]
    VE[Validation Error] --> EH
    DE[Database Error] --> EH
    NE[Network Error] --> EH
    
    %% Error Classification
    EH --> EC{Error Classification}
    
    %% Recovery Strategies
    EC -->|Recoverable| AR[Auto Retry]
    EC -->|User Input Required| UG[User Guidance]
    EC -->|Critical| FB[Fallback Mode]
    
    %% Auto Recovery
    AR --> RC{Retry Count < 3}
    RC -->|Yes| RP[Retry Process]
    RC -->|No| UG
    RP --> S[Success]
    RP --> EH
    
    %% User Guidance
    UG --> UM[User Message]
    UM --> UA[User Action]
    UA --> RP
    
    %% Fallback Mode
    FB --> LM[Limited Mode]
    LM --> CC[Cache Check]
    CC --> LD[Load from Cache]
    
    %% Recovery Success
    S --> NF[Notify Success]
    LD --> NF
    
    %% State Preservation
    EH --> SP[State Preservation]
    SP --> WC[Working Copy Save]
    WC --> RL[Recovery Log]
    
    classDef error fill:#ffebee
    classDef recovery fill:#e8f5e8
    classDef success fill:#e3f2fd
    classDef fallback fill:#fff3e0
    
    class FE,VE,DE,NE,EH,EC error
    class AR,UG,RP,UA,SP,WC,RL recovery
    class S,NF success
    class FB,LM,CC,LD fallback
```

## 外部システム連携フロー

### 🟢 7. MapLibre GL JS 連携フロー

```mermaid
sequenceDiagram
    participant SM as StyleMapService
    participant MG as MapLibre Generator
    participant ML as MapLibre GL JS
    participant Map as Map Display

    SM->>MG: generateMapLibreStyle(config, data)
    
    Note over MG: Color Algorithm Selection
    MG->>MG: selectAlgorithm(config.algorithm)
    
    alt Linear Algorithm
        MG->>MG: calculateLinearMapping(min, max, data)
    else Logarithmic Algorithm
        MG->>MG: calculateLogMapping(min, max, data)
    else Quantile Algorithm
        MG->>MG: calculateQuantileMapping(data)
    else Categorical Algorithm
        MG->>MG: calculateCategoricalMapping(data)
    end
    
    Note over MG: Color Space Conversion
    alt HSV Color Space
        MG->>MG: convertHSVtoRGB(hue, sat, brightness)
    else RGB Color Space
        MG->>MG: interpolateRGB(min, max, value)
    end
    
    Note over MG: Property Generation
    MG->>MG: generateStyleProperty(targetProperty, colors)
    
    MG-->>SM: MapLibreStyleSpec
    SM-->>ML: updateMapStyle(styleSpec)
    ML-->>Map: renderWithNewStyle()
    
    Note over Map: Map Visual Update
```

### 🟡 8. ファイルキャッシュフロー

```mermaid
flowchart LR
    %% File Input
    FI[File Input] --> HS[Hash Calculation]
    HS --> HC{Cache Check}
    
    %% Cache Hit Path
    HC -->|Hit| CR[Cache Retrieve]
    CR --> CD[Cache Data]
    CD --> RP[Return Parsed]
    
    %% Cache Miss Path
    HC -->|Miss| FP[File Parse]
    FP --> PD[Parsed Data]
    PD --> CS[Cache Store]
    CS --> RP
    
    %% Cache Management
    CS --> CM[Cache Management]
    CM --> LE{LRU Eviction}
    LE -->|Space Full| CE[Cache Eviction]
    LE -->|Space Available| CK[Cache Keep]
    
    %% Expiration Management
    CM --> EX[Expiration Check]
    EX --> ET{Expired?}
    ET -->|Yes| CD[Cache Delete]
    ET -->|No| CK
    
    %% Reference Counting
    CR --> RU[Reference Update]
    CD --> RD[Reference Decrement]
    RU --> RC[Reference Count]
    RD --> RC
    
    classDef input fill:#e3f2fd
    classDef cache fill:#f3e5f5
    classDef management fill:#e8f5e8
    classDef output fill:#fff3e0
    
    class FI,HS input
    class HC,CR,CS,CD,CK cache
    class CM,LE,CE,EX,ET,RU,RD,RC management
    class RP,PD output
```

## パフォーマンス最適化フロー

### 🟡 9. 大容量データ処理フロー

```mermaid
flowchart TD
    %% Data Size Assessment
    FI[File Input] --> SA[Size Assessment]
    SA --> SC{Size Check}
    
    %% Processing Strategy Selection
    SC -->|< 10MB| SP[Standard Processing]
    SC -->|10MB - 100MB| CP[Chunked Processing]
    SC -->|> 100MB| WP[Warning + Streaming]
    
    %% Standard Processing
    SP --> MP[Memory Parse]
    MP --> DR[Direct Result]
    
    %% Chunked Processing
    CP --> CS[Chunk Split]
    CS --> PP[Parallel Processing]
    PP --> CR[Chunk Results]
    CR --> MR[Merge Results]
    
    %% Streaming Processing
    WP --> UW[User Warning]
    UW --> ST[Stream Processing]
    ST --> IB[Incremental Buffer]
    IB --> PR[Progress Report]
    PR --> IR[Incremental Result]
    
    %% Memory Management
    PP --> MM[Memory Monitor]
    ST --> MM
    MM --> GC{GC Trigger}
    GC -->|High Memory| FG[Force GC]
    GC -->|Normal| CN[Continue]
    
    %% Result Combination
    DR --> FR[Final Result]
    MR --> FR
    IR --> FR
    
    classDef input fill:#e3f2fd
    classDef strategy fill:#f3e5f5
    classDef processing fill:#e8f5e8
    classDef output fill:#fff3e0
    
    class FI,SA,SC input
    class SP,CP,WP,UW strategy
    class MP,CS,PP,ST,MM,GC,FG,CN processing
    class DR,CR,MR,IB,PR,IR,FR output
```

この詳細なデータフロー図により、plugin-stylemap の全体的なデータの流れ、各コンポーネント間の相互作用、エラーハンドリング、パフォーマンス最適化戦略が明確に理解できます。eria-cartograph の実装パターンを基にした信頼性の高い設計となっています。