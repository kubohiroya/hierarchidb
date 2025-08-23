# 09-5 エンティティシステム仕様

## 1. 概要

HierarchiDBのエンティティシステムは、TreeNodeとエンティティの関係性に基づいた2×3の分類で構成されます。これにより、エンティティのライフサイクル管理がより明確で自動化された形で実現できます。

## 2. エンティティ分類

エンティティは、ツリーノードに紐づけられた情報です。紐付けの種類に応じて次のような2×3の内部的な種類のエンティティがあります。

### ノードとの紐付けの数の構造に応じた分類
- **Peer**: 1対1の関係
- **Group**: 1対Nの関係
- **Relation**: N対Nの関係

### ノードのライフサイクルに応じた分類
- **Persistent**: ノードのライフサイクルと一致
- **Ephemeral**: ノードのCreate/Editダイアログ内で一時的に生成されノードを閉じると削除される

```
              │ Peer           │ Group          │ Relation
              │ (1対1)         │ (1対N)         │ (N対N)
──────────────┼───────────────┼───────────────┼──────────────────
Persistent    │ Peer×Persistent│ Group×Persistent│ Relation×Persistent
(永続的)       │               │               │
──────────────┼───────────────┼───────────────┼──────────────────
Ephemeral     │ Peer×Ephemeral │ Group×Ephemeral│ Relation×Ephemeral
(一時的)       │               │               │
```

### 2.1 データベースとライフサイクル

エンティティは、紐づけられたツリーノードの種類およびライフサイクルに応じて、ツリーノードと一体的に管理されます。

#### CoreDB（永続的データ）
- **保存対象**: TreeNode、PersistentなPeer/Group/Relationエンティティ
- **ライフサイクル**: ツリーノードの作成から削除まで
- **削除条件**: ユーザが明示的に削除、またはTreeNode削除時のカスケード削除

#### EphemeralDB（一時的データ）
- **保存対象**: WorkingCopy、EphemeralなPeer/Group/Relationエンティティ
- **ライフサイクル**: 編集ダイアログのセッション内でのみ生存
- **削除条件**: ダイアログ閉鎖時、WorkingCopy破棄時、またはセッション終了時に自動削除

## 3. 各分類の詳細仕様

### 3.1 PeerEntity（1対1関係）
- **特徴**: 各TreeNodeに対して必ず1つのPeerEntityが存在
- **ライフサイクル**: TreeNodeのライフサイクルと同期
- **例**: StyleMapEntity、BaseMapEntity

```typescript
/**
 * PeerEntity - TreeNodeと1対1で対応するエンティティ
 * 
 * TreeNodeのライフサイクルと同期して作成・削除される。
 * 各TreeNodeに対して必ず1つのPeerEntityが存在する。
 * 
 * @example StyleMapEntity, BaseMapEntity
 */
export interface PeerEntity extends BaseEntity {
  // TreeNodeと1対1で対応するエンティティ
  // TreeNodeのライフサイクルと同期
  referencingNodeId: TreeNodeId;
}
```

### 3.2 GroupEntity（1対N関係）
- **特徴**: 1つのTreeNodeに対して複数のGroupEntityが存在可能
- **ライフサイクル**: 個別に管理される
- **例**: FeatureSubEntity（GeoJSONの個別フィーチャー）、VectorTilesEntity

```typescript
/**
 * GroupEntity - TreeNodeと1対Nで対応するエンティティ
 * 
 * 1つのTreeNodeに対して複数のGroupEntityが存在可能。
 * 個別にライフサイクル管理される。
 * 
 * @example FeatureSubEntity（GeoJSONの個別フィーチャー）
 */
export interface GroupEntity extends BaseEntity {
  referencingNodeId: TreeNodeId;
  type: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.3 RelationalEntity（N対N関係）
- **特徴**: リファレンスカウントによるライフサイクル管理
- **ライフサイクル**: 最後の参照が削除されたときに自動削除
- **例**: TableMetadataEntity（複数のStyleMapで共有される表データ）

```typescript
/**
 * RelationalEntity - 複数のTreeNodeとN対Nで対応するエンティティ
 * 
 * リファレンスカウントによるライフサイクル管理。
 * 最後の参照が削除されたときに自動削除される。
 * 
 * @example TableMetadataEntity（複数のStyleMapで共有される表データ）
 */
export interface RelationalEntity extends BaseEntity {
  referencingNodeIds: TreeNodeId[];
  referenceCount: number;
  lastAccessedAt: Timestamp;
}
```

## 4. ワーキングコピーとエンティティ管理
- **関係性**: TreeNode : Entity = 1 : N
- **保存場所**: EphemeralDB
- **例**: BatchBufferData、FeatureIndex、TileBuffer（中間処理データ）
- **削除タイミング**: バッチ処理完了、ダイアログ閉鎖時

```typescript
export interface EphemeralGroupEntity extends GroupEntity {
  referencingNodeId: TreeNodeId;
  // バッチ処理セッション管理
  sessionMetadata: {
    batchSessionId: UUID;
    processingStage: 'download' | 'simplify1' | 'simplify2' | 'vectortiles';
    isIntermediate: boolean;
    dependsOn?: UUID[]; // 依存する他のEphemeralEntity
  };
  // 自動削除設定
  autoDelete: {
    onSessionComplete: boolean;
    onDialogClose: boolean;
    onWorkingCopyDiscard: boolean;
    maxIdleTime: number; // ms
  };
}
```

### 3.5 PersistentRelationalEntity
- **関係性**: TreeNode : Entity = N : N
- **保存場所**: CoreDB
- **例**: TableMetadataEntity、SharedStyleRuleEntity
- **削除タイミング**: リファレンスカウント0で自動削除

```typescript
export interface PersistentRelationalEntity extends RelationalEntity {
  // 永続的な参照管理
  persistentReferences: {
    referencingNodeIds: TreeNodeId[];
    referenceCount: number;
    strongReferences: TreeNodeId[]; // 削除を阻止する強参照
    weakReferences: TreeNodeId[];   // 削除を阻止しない弱参照
  };
  // 共有リソース管理
  sharedMetadata: {
    contentHash: string; // 重複排除用
    shareCount: number;
    lastAccessed: Timestamp;
    accessFrequency: number;
  };
}
```

## 4. ワーキングコピーとエンティティ管理

### 4.1 ワーキングコピーの仕組み

オブジェクトの編集が開始されると、オブジェクトの「ワーキングコピー」が作成され、ストレージ上で永続化状態となります。

```typescript
export interface EphemeralRelationalEntity extends RelationalEntity {
  // セッション単位での参照管理
  sessionReferences: {
    referencingSessions: UUID[];
    sessionCount: number;
    primarySession?: UUID; // メインセッション
  };
  // 一時的な共有設定
  temporarySharing: {
    maxSessions: number;
    autoDeleteWhenEmpty: boolean;
    sessionTimeout: number; // ms
  };
}
```

- **ワーキングコピーのツリーノード**: オリジナルとは別のツリーノード
  - オリジナルに対して、ワーキングコピーは0個または1個が存在可能
  - ワーキングコピーはEphemeralDBに保存される
  - ワーキングコピーでは、オリジナルのツリーノードのIDと同じIDを用いる

- **コピーオンライト方式**: PersistentなPeer/Group/Relationエンティティは、必要に応じて作成される

### 4.2 編集作業のフロー

1. **ワーキングコピー作成**
   - 新規作成: デフォルトの内容で作成
   - 編集: オリジナルのノード内容をもとに作成
   
2. **編集作業**
   - 画面遷移のたびに編集内容がワーキングコピーに反映
   
3. **完了/中断**
   - 完了時: ワーキングコピーの内容をオリジナルに反映し、ワーキングコピーを破棄
   - 中断時: ワーキングコピーを破棄（ドラフト保存可能な場合あり）

### 4.3 ドラフト状態

編集作業を中断する際に、ワーキングコピーを破棄せずに未完成な状態「ドラフト状態」として残せる場合があります。

- **ドラフト状態の定義**: ツリーノードのisDraftプロパティがtrueの状態
- **保存可否**: ツリーノードの種類による
- **制限**: ドラフト状態のオブジェクトは通常の利用に制限が生じる

## 5. プラグイン実装例

### 5.1 Shapesプラグインでの適用

#### Persistentエンティティ（CoreDB保存）

```typescript
// Peer×Persistent（メイン設定）
export interface ShapesEntity extends PeerEntity {
  style: ShapeStyle;
  metadata: ShapesMetadata;
  persistentMetadata: {
    createdAt: Timestamp;
    lastModified: Timestamp;
    version: number;
  };
}

// PersistentGroupEntity（最終的なVectorTiles）
export interface VectorTileEntity extends PersistentGroupEntity {
  index: number; // タイル番号
  zoom: number;
  x: number;
  y: number;
  format: 'mvt' | 'geojson';
  data: ArrayBuffer; // タイルデータ
  metadata: VectorTileMetadata;
  persistentConfig: {
    retentionPolicy: 'until_parent_deleted';
    compressionEnabled: true;
  };
}

// PersistentRelationalEntity（共有設定テンプレート）
export interface BatchConfigTemplate extends PersistentRelationalEntity {
  id: UUID;
  name: string;
  config: BatchConfig;
  persistentReferences: {
    referencingNodeIds: TreeNodeId[];
    referenceCount: number;
    strongReferences: TreeNodeId[];
    weakReferences: TreeNodeId[];
  };
  sharedMetadata: {
    contentHash: string;
    shareCount: number;
    lastAccessed: Timestamp;
    accessFrequency: number;
  };
}
```

#### Ephemeral Entities（中間処理データ）

```typescript
// EphemeralGroupEntity（ダウンロードバッファ）
export interface BatchBufferEntity extends EphemeralGroupEntity {
  id: UUID;
  parentNodeId: TreeNodeId;
  countryCode: string;
  adminLevel: number;
  dataSource: DataSourceName;
  data: GeoJSON.FeatureCollection;
  sessionMetadata: {
    batchSessionId: UUID;
    processingStage: 'download';
    isIntermediate: true;
    dependsOn: [];
  };
  autoDelete: {
    onSessionComplete: true;
    onDialogClose: true;
    onWorkingCopyDiscard: true;
    maxIdleTime: 3600000; // 1時間
  };
}

// EphemeralGroupEntity（Feature Index）
export interface FeatureIndexEntity extends EphemeralGroupEntity {
  id: UUID;
  parentNodeId: TreeNodeId;
  bufferId: string; // BatchBufferEntityへの参照
  features: ProcessedFeature[];
  stats: FeatureStats;
  sessionMetadata: {
    batchSessionId: UUID;
    processingStage: 'simplify1';
    isIntermediate: true;
    dependsOn: [/* BatchBufferEntity.id */];
  };
  autoDelete: {
    onSessionComplete: true;
    onDialogClose: true;
    onWorkingCopyDiscard: true;
    maxIdleTime: 1800000; // 30分
  };
}

// EphemeralGroupEntity（Tile Buffer）
export interface TileBufferEntity extends EphemeralGroupEntity {
  id: UUID;
  parentNodeId: TreeNodeId;
  indexId: string; // FeatureIndexEntityへの参照
  zoom: number;
  x: number;
  y: number;
  features: SimplifiedFeature[];
  sessionMetadata: {
    batchSessionId: UUID;
    processingStage: 'simplify2';
    isIntermediate: true;
    dependsOn: [/* FeatureIndexEntity.id */];
  };
  autoDelete: {
    onSessionComplete: true;
    onDialogClose: false; // vectortilesステージまで保持
    onWorkingCopyDiscard: true;
    maxIdleTime: 900000; // 15分
  };
}

// EphemeralRelationalEntity（BatchSession）
export interface BatchSessionEntity extends EphemeralRelationalEntity {
  id: UUID;
  config: BatchConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stages: Record<string, StageStatus>;
  sessionReferences: {
    referencingSessions: UUID[];
    sessionCount: number;
    primarySession?: UUID;
  };
  temporarySharing: {
    maxSessions: 1; // バッチセッションは通常単一
    autoDeleteWhenEmpty: true;
    sessionTimeout: 7200000; // 2時間
  };
}
```

### 4.2 自動ライフサイクル管理の流れ

#### バッチ処理開始時
1. **BatchSessionEntity（EphemeralRelational）**を作成
2. **BatchBufferEntity（EphemeralGroup）**でダウンロードデータを保存
3. **FeatureIndexEntity（EphemeralGroup）**で処理済みFeatureを保存
4. **TileBufferEntity（EphemeralGroup）**でタイルデータを保存

#### バッチ処理完了時
1. **VectorTileEntity（PersistentGroup）**を作成（最終成果物）
2. 中間データ（EphemeralGroup）を自動削除
3. **BatchSessionEntity**を完了状態にして自動削除

#### ダイアログ閉鎖時
1. 進行中の**BatchSessionEntity**をチェック
2. `autoDelete.onDialogClose = true`のEphemeralEntityを削除
3. 未完了の中間データを自動クリーンアップ

#### WorkingCopy破棄時
1. 関連する全EphemeralEntityを削除
2. PersistentEntityは保持（コミット済みのため）

## 5. 実装アーキテクチャ

### 5.1 データベース分離

```typescript
// packages/worker/src/db/DatabaseManager.ts
export class DatabaseManager {
  private coreDB: Dexie;      // Persistent Entities
  private ephemeralDB: Dexie; // Ephemeral Entities
  
  constructor() {
    this.coreDB = new Dexie('HierarchiDB_Core');
    this.ephemeralDB = new Dexie('HierarchiDB_Ephemeral');
    
    // Ephemeral DBは起動時にクリア
    this.ephemeralDB.on('open', () => {
      this.cleanupExpiredEphemeralData();
    });
  }
  
  getDatabase(entityType: EntityPersistenceType): Dexie {
    return entityType === 'persistent' ? this.coreDB : this.ephemeralDB;
  }
}
```

### 5.2 自動削除サービス

```typescript
// packages/worker/src/services/EphemeralCleanupService.ts
export class EphemeralCleanupService {
  private timers = new Map<UUID, NodeJS.Timeout>();
  
  /**
   * ダイアログ閉鎖時の自動削除
   */
  async onDialogClose(nodeId: TreeNodeId, dialogType: string): Promise<void> {
    const entities = await this.findEphemeralEntitiesByNode(nodeId);
    
    for (const entity of entities) {
      if (entity.autoDelete.onDialogClose) {
        await this.deleteEphemeralEntity(entity);
      }
    }
  }
  
  /**
   * WorkingCopy破棄時の自動削除
   */
  async onWorkingCopyDiscard(workingCopyId: UUID): Promise<void> {
    const entities = await this.findEphemeralEntitiesByWorkingCopy(workingCopyId);
    
    for (const entity of entities) {
      if (entity.autoDelete.onWorkingCopyDiscard) {
        await this.deleteEphemeralEntity(entity);
      }
    }
  }
  
  /**
   * セッション完了時の自動削除
   */
  async onSessionComplete(sessionId: UUID): Promise<void> {
    const entities = await this.findEphemeralEntitiesBySession(sessionId);
    
    for (const entity of entities) {
      if (entity.autoDelete.onSessionComplete) {
        await this.deleteEphemeralEntity(entity);
      }
    }
  }
  
  /**
   * アイドルタイムアウトによる自動削除
   */
  scheduleAutoDelete(entity: EphemeralEntity): void {
    const timeout = setTimeout(async () => {
      await this.deleteEphemeralEntity(entity);
      this.timers.delete(entity.id);
    }, entity.autoDelete.maxIdleTime);
    
    this.timers.set(entity.id, timeout);
  }
}
```

### 5.3 統合ライフサイクル管理

```typescript
// packages/worker/src/services/SixClassificationLifecycleManager.ts
export class SixClassificationLifecycleManager extends AutoLifecycleManager {
  constructor(
    registrationService: EntityRegistrationService,
    workingCopyManager: WorkingCopyManager,
    dependencyResolver: DependencyResolver,
    databaseManager: DatabaseManager,
    ephemeralCleanupService: EphemeralCleanupService
  ) {
    super(registrationService, workingCopyManager, dependencyResolver, databaseManager);
    this.ephemeralCleanupService = ephemeralCleanupService;
  }
  
  /**
   * エンティティの分類に応じたデータベース選択
   */
  protected getDatabase(entityMetadata: ExtendedEntityMetadata): Dexie {
    return this.databaseManager.getDatabase(entityMetadata.persistenceType);
  }
  
  /**
   * エンティティ作成時の自動設定
   */
  async createEntityWithClassification(
    nodeId: TreeNodeId,
    entityMetadata: ExtendedEntityMetadata,
    data: any
  ): Promise<any> {
    const db = this.getDatabase(entityMetadata);
    
    if (entityMetadata.persistenceType === 'ephemeral') {
      // Ephemeralエンティティには自動削除設定を追加
      data.ephemeralMetadata = {
        sessionId: this.getCurrentSessionId(),
        expiresAt: Date.now() + entityMetadata.autoDelete.maxIdleTime,
        autoDeleteTriggers: entityMetadata.autoDelete
      };
      
      // 自動削除スケジューリング
      this.ephemeralCleanupService.scheduleAutoDelete(data);
    }
    
    return await db.table(entityMetadata.storeName).add(data);
  }
}
```

## 6. plugin-shapes具体的な実装例

### 6.1 マルチステップダイアログでの使用例

```typescript
// packages/plugins/_shapes_buggy/src/ui/containers/ShapesCreateDialog.tsx
export const ShapesCreateDialog: React.FC<Props> = ({ nodeId, onClose, onSave }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [batchSession, setBatchSession] = useState<BatchSessionEntity | null>(null);
  const [intermediateData, setIntermediateData] = useState<{
    buffers: BatchBufferEntity[];
    indexes: FeatureIndexEntity[];
    tiles: TileBufferEntity[];
  }>({ buffers: [], indexes: [], tiles: [] });
  
  // ステップ1: ダウンロード（EphemeralGroupEntity作成）
  const handleDownload = async (config: BatchConfig) => {
    // BatchSessionEntity（EphemeralRelational）を作成
    const session = await createBatchSession(nodeId, config);
    setBatchSession(session);
    
    // BatchBufferEntity（EphemeralGroup）を作成
    const buffers = await downloadAndCreateBuffers(session.id, config);
    setIntermediateData(prev => ({ ...prev, buffers }));
  };
  
  // ステップ2: Feature処理（EphemeralGroupEntity作成）
  const handleFeatureProcessing = async () => {
    if (!batchSession) return;
    
    // FeatureIndexEntity（EphemeralGroup）を作成
    const indexes = await processFeatures(batchSession.id, intermediateData.buffers);
    setIntermediateData(prev => ({ ...prev, indexes }));
  };
  
  // ステップ3: Tile生成（EphemeralGroupEntity → PersistentGroupEntity変換）
  const handleTileGeneration = async () => {
    if (!batchSession) return;
    
    // 中間タイル（EphemeralGroup）を作成
    const tiles = await generateTileBuffers(batchSession.id, intermediateData.indexes);
    setIntermediateData(prev => ({ ...prev, tiles }));
    
    // 最終VectorTiles（PersistentGroup）を作成
    const finalTiles = await generateFinalVectorTiles(nodeId, tiles);
    
    // セッション完了 → 自動的にEphemeralEntityが削除される
    await completeBatchSession(batchSession.id);
  };
  
  // ダイアログ閉鎖時の自動クリーンアップ
  useEffect(() => {
    return () => {
      if (batchSession) {
        // EphemeralCleanupServiceが自動的に中間データを削除
        ephemeralCleanupService.onDialogClose(nodeId, '_shapes_buggy-create');
      }
    };
  }, [batchSession, nodeId]);
};
```

## 7. メリットと実装効果

### 7.1 開発者体験の向上
- **明確なライフサイクル**: Persistent/Ephemeralの区別で管理が簡単
- **自動クリーンアップ**: 手動でのデータ削除処理が不要
- **一貫性のあるパターン**: 6分類により標準的な実装パターンを確立

### 7.2 システムの信頼性向上
- **メモリリーク防止**: Ephemeralデータの自動削除
- **データ整合性**: 明確な依存関係管理
- **パフォーマンス最適化**: 不要データの自動削除による軽量化

### 7.3 ユーザー体験の向上
- **レスポンシブなUI**: 中間データの効率的な管理
- **安全な操作**: 中断時の自動クリーンアップ
- **予測可能な動作**: 一貫したライフサイクル管理

この6分類システムにより、特にplugin-shapesのような複雑なバッチ処理を含むプラグインの開発・保守が大幅に簡素化されます。