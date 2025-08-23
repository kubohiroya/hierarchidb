# 9. プラグインアーキテクチャ総合仕様

## 概要

HierarchiDBのプラグインシステムは、6分類エンティティシステムと自動ライフサイクル管理を組み合わせた先進的なアーキテクチャです。本章では、プラグイン開発に必要な全ての情報を体系的に整理し、実装手順からベストプラクティスまでを包括的に説明します。

## 9.1 プラグインアーキテクチャ概要

### 9.1.1 設計思想

HierarchiDBのプラグインシステムは以下の設計思想に基づいています：

1. **宣言的設定**: コードではなく設定による動作定義
2. **自動ライフサイクル管理**: 手動でのデータ管理コード排除
3. **6分類エンティティシステム**: 明確なデータ分類による適切な管理
4. **型安全性**: TypeScriptによる静的型チェック
5. **拡張性**: 既存機能に影響しない新機能追加

### 9.1.2 アーキテクチャ階層

```
┌─────────────────────────────────────────────────────────────────┐
│                    Plugin Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: UI Integration (React Components, Routing)           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - Plugin UI Components (Dialog, Panel, Form)          │    │
│  │  - React Router Integration                            │    │
│  │  - Theme & Styling Integration                         │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Plugin Definition & Registration                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - NodeTypeDefinition (Declarative Configuration)      │    │
│  │  - Entity Metadata Registration                        │    │
│  │  - Lifecycle Hook Definition                           │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Automatic Lifecycle Management                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - AutoLifecycleManager                                │    │
│  │  - EphemeralCleanupService                             │    │
│  │  - DependencyResolver                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: 6-Class Entity System                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            │ Peer        │ Group       │ Relational    │    │
│  │ Persistent │ 設定データ   │ 成果物      │ 共有リソース   │    │
│  │ Ephemeral  │ UI状態      │ 中間データ   │ セッション    │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 5: Database Storage (CoreDB/EphemeralDB)                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - Dynamic Schema Registration                         │    │
│  │  - Automatic Index Creation                            │    │
│  │  - Transaction Boundary Management                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 9.1.3 プラグインで実現できること

#### 基本機能
- **新しいノードタイプの定義**: basemap、stylemap、shape等
- **カスタムエンティティの永続化**: 6分類システムによる適切な管理
- **自動ライフサイクル管理**: 作成・更新・削除の自動処理
- **専用UIコンポーネント**: Dialog、Panel、Form等

#### 高度な機能
- **マルチステップ処理**: バッチ処理とワークフロー管理
- **データ変換パイプライン**: 中間データから最終成果物への変換
- **セッション管理**: 一時的なワークスペース
- **共有リソース管理**: 複数ノード間でのリソース共有

## 9.2 6分類エンティティシステム

### 9.2.1 分類マトリックス

```typescript
// 6分類の組み合わせ
export type EntityClassification = 
  | 'persistent-peer'      // 永続1対1: 設定データ
  | 'persistent-group'     // 永続1対N: 成果物
  | 'persistent-relational'// 永続N対N: 共有リソース
  | 'ephemeral-peer'       // 一時1対1: UI状態
  | 'ephemeral-group'      // 一時1対N: 中間データ
  | 'ephemeral-relational';// 一時N対N: セッション
```

### 9.2.2 各分類の特徴と用途

#### Persistent-Peer（永続1対1）
- **用途**: ノードの設定データ、メタデータ
- **ライフサイクル**: TreeNodeと同期
- **削除タイミング**: TreeNode削除時に自動削除
- **例**: StyleMapEntity、BaseMapEntity

```typescript
export interface StyleMapEntity extends PersistentPeerEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  tableMetadataId?: string; // RelationalEntityへの参照
  filterRules: FilterRule[];
  styleRules: StyleRule[];
  isActive: boolean;
  persistentMetadata: {
    retentionPolicy: 'until_parent_deleted';
    compressionEnabled: false;
    contentHash: string;
  };
}
```

#### Ephemeral-Group（一時1対N）
- **用途**: 中間処理データ、バッチ処理の段階データ
- **ライフサイクル**: セッションまたはダイアログスコープ
- **削除タイミング**: 処理完了、ダイアログ閉鎖時
- **例**: BatchBufferEntity、FeatureIndexEntity

```typescript
export interface BatchBufferEntity extends EphemeralGroupEntity {
  id: UUID;
  parentNodeId: TreeNodeId;
  countryCode: string;
  adminLevel: number;
  data: GeoJSON.FeatureCollection;
  ephemeralMetadata: {
    sessionId: UUID;
    expiresAt: Timestamp;
    autoDeleteTriggers: [
      { event: 'session_complete', delay: 0 },
      { event: 'dialog_close', delay: 0 },
      { event: 'idle_timeout', delay: 3600000 }
    ];
  };
}
```

#### Persistent-Group（永続1対N）
- **用途**: 最終成果物、永続的なデータコレクション
- **ライフサイクル**: 明示的削除まで永続
- **削除タイミング**: ユーザ操作またはTreeNode削除時
- **例**: VectorTileEntity、ProcessedFeatureEntity

#### Persistent-Relational（永続N対N）
- **用途**: 共有リソース、テンプレート、設定ライブラリ
- **ライフサイクル**: リファレンスカウント管理
- **削除タイミング**: 参照カウント0で自動削除
- **例**: TableMetadataEntity、StyleRuleTemplateEntity

#### Ephemeral-Peer（一時1対1）
- **用途**: ダイアログ状態、フォーム入力データ
- **ライフサイクル**: ダイアログまたはセッションスコープ
- **削除タイミング**: ダイアログ閉鎖時
- **例**: DialogStateEntity、FormDataEntity

#### Ephemeral-Relational（一時N対N）
- **用途**: バッチセッション、一時的な共有状態
- **ライフサイクル**: セッション管理
- **削除タイミング**: 全参照セッション終了時
- **例**: BatchSessionEntity、TemporaryWorkspaceEntity

## 9.3 自動ライフサイクル管理

### 9.3.1 ライフサイクル管理の仕組み

#### エンティティ登録による自動管理
```typescript
export interface EntityRegistration {
  classification: EntityClassification;
  storeName: string;
  relationship: EntityRelationship;
  dependencies?: EntityDependency[];
  lifecycle?: EntityLifecycleHooks;
  autoDelete?: AutoDeleteConfig;
}

export interface AutoDeleteConfig {
  triggers: AutoDeleteTrigger[];
  conditions?: DeleteCondition[];
  cascadeRules?: CascadeRule[];
}
```

#### 自動削除トリガー
```typescript
export interface AutoDeleteTrigger {
  event: 'node_delete' | 'dialog_close' | 'session_complete' | 
         'working_copy_discard' | 'idle_timeout' | 'reference_zero';
  delay?: number; // 遅延削除（ms）
  condition?: (entity: any, context: any) => boolean;
}
```

### 9.3.2 依存関係解決

#### 削除順序の自動決定
```typescript
export class DependencyResolver {
  /**
   * 削除時の依存関係を解決し、適切な順序を決定
   */
  resolveDeletionOrder(entities: EntityMetadata[]): EntityMetadata[] {
    // 依存関係グラフを構築
    const graph = this.buildDependencyGraph(entities);
    
    // トポロジカルソートで削除順序を決定
    return this.topologicalSort(graph, { reverse: true });
  }
  
  /**
   * 作成時の依存関係を解決し、適切な順序を決定
   */
  resolveCreationOrder(entities: EntityMetadata[]): EntityMetadata[] {
    const graph = this.buildDependencyGraph(entities);
    return this.topologicalSort(graph, { reverse: false });
  }
}
```

## 9.4 プラグイン定義の実装

### 9.4.1 NodeTypeDefinition構造

```typescript
export interface NodeTypeDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TSubEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties
> {
  // 基本情報
  readonly nodeType: TreeNodeType;
  readonly name: string;
  readonly displayName: string;
  readonly icon?: string;
  readonly color?: string;
  
  // 自動ライフサイクル管理設定
  readonly autoLifecycle: {
    entities: EntityRegistration[];
    globalHooks?: GlobalLifecycleHooks;
    cleanupPolicy?: CleanupPolicy;
  };
  
  // UI設定
  readonly ui?: {
    dialogComponent?: React.ComponentType<NodeDialogProps<TEntity>>;
    panelComponent?: React.ComponentType<NodePanelProps>;
    formComponent?: React.ComponentType<NodeFormProps<TEntity>>;
    iconComponent?: React.ComponentType<IconProps>;
  };
  
  // ルーティング設定
  readonly routing?: {
    routes?: RouteDefinition[];
    middleware?: RouteMiddleware[];
  };
  
  // API拡張
  readonly api?: {
    workerExtensions?: WorkerAPIExtensions;
    clientExtensions?: ClientAPIExtensions;
  };
  
  // バリデーション
  readonly validation?: {
    namePattern?: RegExp;
    maxChildren?: number;
    allowedChildTypes?: TreeNodeType[];
    customValidators?: ValidationRule<TEntity>[];
  };
}
```

### 9.4.2 実装例：StyleMapプラグイン

```typescript
// packages/plugins/stylemap/src/definitions/StyleMapDefinition.ts

export const StyleMapDefinition: NodeTypeDefinition = {
  nodeType: 'stylemap',
  name: 'StyleMap',
  displayName: 'スタイルマップ',
  icon: 'palette',
  color: '#2196F3',
  
  // 6分類エンティティシステムによる自動管理
  autoLifecycle: {
    entities: [
      // PersistentPeer: メイン設定エンティティ
      {
        classification: 'persistent-peer',
        storeName: 'styleMapEntities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
          autoCleanupOrphans: false,
        },
        dependencies: [
          {
            targetStore: 'tableMetadataEntities',
            dependencyType: 'reference',
            referenceField: 'tableMetadataId',
            onDelete: 'nullify',
          }
        ],
      },
      
      // PersistentRelational: 共有テーブルメタデータ
      {
        classification: 'persistent-relational',
        storeName: 'tableMetadataEntities',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
          autoCleanupOrphans: true,
        },
        lifecycle: {
          beforeDelete: async (entity, context) => {
            // カスタム削除前処理
            console.log(`Cleaning up table metadata: ${entity.id}`);
          },
        },
      }
    ],
    
    globalHooks: {
      afterCreate: async (nodeId, entities) => {
        // ノード作成後の全体処理
        console.log(`StyleMap node created: ${nodeId}`);
      },
      beforeDelete: async (nodeId, entities) => {
        // ノード削除前の全体処理
        await this.cleanupRelatedResources(nodeId);
      },
    },
    
    cleanupPolicy: {
      maxRetries: 3,
      retryDelay: 1000,
      failureHandling: 'log_and_continue',
    },
  },
  
  ui: {
    dialogComponent: StyleMapDialog,
    panelComponent: StyleMapPanel,
    formComponent: StyleMapForm,
  },
  
  validation: {
    namePattern: /^[a-zA-Z0-9_-]+$/,
    maxChildren: 0, // スタイルマップは子を持たない
    customValidators: [
      {
        name: 'tableMetadataValidation',
        validate: async (entity) => {
          if (entity.tableMetadataId) {
            const exists = await checkTableMetadataExists(entity.tableMetadataId);
            return exists ? 
              { valid: true } : 
              { valid: false, message: 'Referenced table metadata not found' };
          }
          return { valid: true };
        },
      }
    ],
  },
};
```

### 9.4.3 実装例：Shapesプラグイン（6分類全使用）

```typescript
// packages/plugins/_shapes_buggy/src/definitions/ShapesDefinition.ts

export const ShapesDefinition: NodeTypeDefinition = {
  nodeType: '_shapes_buggy',
  name: 'Shapes',
  displayName: 'シェイプス',
  icon: 'map',
  color: '#4CAF50',
  
  autoLifecycle: {
    entities: [
      // PersistentPeer: メイン設定
      {
        classification: 'persistent-peer',
        storeName: 'shapesEntities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
          autoCleanupOrphans: false,
        },
      },
      
      // PersistentGroup: 最終成果物（VectorTiles）
      {
        classification: 'persistent-group',
        storeName: 'vectorTileEntities',
        relationship: {
          type: 'one-to-many',
          foreignKeyField: 'parentNodeId',
          cascadeDelete: true,
          autoCleanupOrphans: false,
        },
      },
      
      // PersistentRelational: 共有設定テンプレート
      {
        classification: 'persistent-relational',
        storeName: 'batchConfigTemplates',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
          autoCleanupOrphans: true,
        },
      },
      
      // EphemeralPeer: ダイアログ状態
      {
        classification: 'ephemeral-peer',
        storeName: 'shapesDialogStates',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
          autoCleanupOrphans: true,
        },
        autoDelete: {
          triggers: [
            { event: 'dialog_close', delay: 0 },
            { event: 'working_copy_discard', delay: 0 },
            { event: 'idle_timeout', delay: 300000 }, // 5分
          ],
        },
      },
      
      // EphemeralGroup: 中間処理データ
      {
        classification: 'ephemeral-group',
        storeName: 'batchBufferEntities',
        relationship: {
          type: 'one-to-many',
          foreignKeyField: 'parentNodeId',
          cascadeDelete: true,
          autoCleanupOrphans: true,
        },
        autoDelete: {
          triggers: [
            { event: 'session_complete', delay: 0 },
            { event: 'dialog_close', delay: 60000 }, // 1分遅延
            { event: 'idle_timeout', delay: 3600000 }, // 1時間
          ],
        },
      },
      
      // EphemeralRelational: バッチセッション
      {
        classification: 'ephemeral-relational',
        storeName: 'batchSessionEntities',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
          autoCleanupOrphans: true,
        },
        autoDelete: {
          triggers: [
            { event: 'reference_zero', delay: 0 },
            { event: 'session_complete', delay: 300000 }, // 5分遅延
          ],
        },
      },
    ],
  },
  
  ui: {
    dialogComponent: ShapesCreateDialog,
    panelComponent: ShapesPanel,
  },
};
```

## 9.5 プラグイン開発手順

### 9.5.1 開発環境セットアップ

```bash
# 1. プラグインディレクトリ作成
mkdir packages/plugins/my-plugin
cd packages/plugins/my-plugin

# 2. package.json作成
npm init @hierarchidb/plugin

# 3. 基本ファイル構造作成
mkdir -p src/{types,handlers,definitions,ui/containers}
```

### 9.5.2 基本ファイル構造

```
packages/plugins/my-plugin/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── openstreetmap-type.ts                    # メインエクスポート
│   ├── types/
│   │   ├── openstreetmap-type.ts               # 型定義エクスポート
│   │   └── MyPluginEntity.ts      # エンティティ型定義
│   ├── definitions/
│   │   └── MyPluginDefinition.ts  # プラグイン定義
│   ├── handlers/
│   │   └── MyPluginHandler.ts     # カスタムハンドラー（必要な場合）
│   └── ui/
│       ├── components/
│       │   ├── MyPluginDialog.tsx # ダイアログコンポーネント
│       │   ├── MyPluginPanel.tsx  # パネルコンポーネント
│       │   └── openstreetmap-type.ts
│       └── openstreetmap-type.ts
├── README.md
└── CHANGELOG.md
```

### 9.5.3 実装ステップ

#### Step 1: エンティティ型定義

```typescript
// src/types/MyPluginEntity.ts

import type { 
  PersistentPeerEntity, 
  EphemeralGroupEntity,
  TreeNodeId, 
  UUID,
  WorkingCopyProperties 
} from '@hierarchidb/core';

// メインエンティティ（PersistentPeer）
export interface MyPluginProperties {
  name: string;
  description?: string;
  settings: MyPluginSettings;
  status: 'active' | 'inactive';
}

export type MyPluginEntity = PersistentPeerEntity & MyPluginProperties;
export type MyPluginWorkingCopy = MyPluginEntity & WorkingCopyProperties;

// 設定構造
export interface MyPluginSettings {
  option1: string;
  option2: number;
  option3: boolean;
}

// 中間データエンティティ（EphemeralGroup）
export interface MyPluginDataEntity extends EphemeralGroupEntity {
  id: UUID;
  parentNodeId: TreeNodeId;
  dataType: 'raw' | 'processed' | 'result';
  data: any;
  processedAt?: Timestamp;
}
```

#### Step 2: プラグイン定義

```typescript
// src/definitions/MyPluginDefinition.ts

import type { NodeTypeDefinition } from '@hierarchidb/core';
import { MyPluginDialog, MyPluginPanel } from '../ui';
import type { MyPluginEntity, MyPluginWorkingCopy } from '../types';

export const MyPluginDefinition: NodeTypeDefinition<
  MyPluginEntity,
  never,
  MyPluginWorkingCopy
> = {
  nodeType: 'my-plugin',
  name: 'MyPlugin',
  displayName: 'マイプラグイン',
  icon: 'extension',
  color: '#9C27B0',
  
  autoLifecycle: {
    entities: [
      // PersistentPeer: メイン設定
      {
        classification: 'persistent-peer',
        storeName: 'myPluginEntities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
          autoCleanupOrphans: false,
        },
      },
      
      // EphemeralGroup: 処理データ
      {
        classification: 'ephemeral-group',
        storeName: 'myPluginDataEntities',
        relationship: {
          type: 'one-to-many',
          foreignKeyField: 'parentNodeId',
          cascadeDelete: true,
          autoCleanupOrphans: true,
        },
        autoDelete: {
          triggers: [
            { event: 'dialog_close', delay: 0 },
            { event: 'session_complete', delay: 0 },
            { event: 'idle_timeout', delay: 1800000 }, // 30分
          ],
        },
      },
    ],
    
    globalHooks: {
      afterCreate: async (nodeId, entities) => {
        console.log(`MyPlugin node created: ${nodeId}`);
        // 初期設定処理
        await initializeMyPlugin(nodeId);
      },
      
      beforeDelete: async (nodeId, entities) => {
        console.log(`MyPlugin node deleting: ${nodeId}`);
        // クリーンアップ処理
        await cleanupMyPlugin(nodeId);
      },
    },
  },
  
  ui: {
    dialogComponent: MyPluginDialog,
    panelComponent: MyPluginPanel,
  },
  
  validation: {
    namePattern: /^[a-zA-Z0-9_-]+$/,
    maxChildren: 10,
    customValidators: [
      {
        name: 'settingsValidation',
        validate: async (entity) => {
          if (!entity.settings.option1) {
            return { valid: false, message: 'Option1 is required' };
          }
          return { valid: true };
        },
      }
    ],
  },
};
```

#### Step 3: UIコンポーネント実装

```typescript
// src/ui/containers/MyPluginDialog.tsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import type { NodeDialogProps } from '@hierarchidb/core';
import type { MyPluginEntity } from '../../types';

export const MyPluginDialog: React.FC<NodeDialogProps<MyPluginEntity>> = ({
  nodeId,
  nodeType,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<MyPluginEntity>>({});
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (nodeId) {
      // 既存エンティティの読み込み
      loadExistingEntity(nodeId).then(setFormData);
    }
  }, [nodeId]);
  
  const handleSave = async () => {
    setLoading(true);
    try {
      if (onSave) {
        await onSave(formData);
      }
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open maxWidth="md" fullWidth>
      <DialogTitle>
        {nodeId ? 'Edit MyPlugin' : 'Create MyPlugin'}
      </DialogTitle>
      <DialogContent>
        {/* フォームコンポーネント */}
        <MyPluginForm
          entity={formData}
          onChange={setFormData}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={loading}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

#### Step 4: プラグイン登録

```typescript
// src/openstreetmap-type.ts

export * from './types';
export * from './definitions';
export * from './ui';

// プラグイン定義のエクスポート
export { MyPluginDefinition } from './definitions/MyPluginDefinition';

// 自動登録（アプリ起動時に実行される）
import { NodeTypeRegistry } from '@hierarchidb/worker';
import { MyPluginDefinition } from './definitions/MyPluginDefinition';

// プラグイン登録
NodeTypeRegistry.getInstance().register(MyPluginDefinition);
```

## 9.6 高度な機能

### 9.6.1 マルチステップ処理

```typescript
// バッチ処理を含むマルチステップダイアログの実装例
export const MultiStepProcessDialog: React.FC<Props> = ({ nodeId, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionData, setSessionData] = useState<{
    session: EphemeralRelationalEntity;
    intermediateData: EphemeralGroupEntity[];
  } | null>(null);
  
  // Step 1: 初期設定とセッション作成
  const handleStep1Complete = async (config: any) => {
    // EphemeralRelationalEntity（セッション）を作成
    const session = await createProcessingSession(nodeId, config);
    setSessionData({ session, intermediateData: [] });
    setCurrentStep(1);
  };
  
  // Step 2: データ処理とEphemeralGroupEntity作成
  const handleStep2Complete = async (inputData: any) => {
    if (!sessionData) return;
    
    // EphemeralGroupEntity（中間データ）を作成
    const processedData = await processInputData(sessionData.session.id, inputData);
    setSessionData(prev => ({
      ...prev!,
      intermediateData: [...prev!.intermediateData, ...processedData]
    }));
    setCurrentStep(2);
  };
  
  // Step 3: 最終処理とPersistentGroupEntity作成
  const handleStep3Complete = async () => {
    if (!sessionData) return;
    
    // PersistentGroupEntity（最終成果物）を作成
    await generateFinalResults(nodeId, sessionData.intermediateData);
    
    // セッション完了 → EphemeralEntityが自動削除される
    await completeProcessingSession(sessionData.session.id);
    
    onClose();
  };
  
  // ダイアログクローズ時の自動クリーンアップ
  useEffect(() => {
    return () => {
      if (sessionData) {
        // EphemeralCleanupServiceが自動的に中間データを削除
        cleanupProcessingSession(sessionData.session.id);
      }
    };
  }, [sessionData]);
  
  return (
    <StepperDialog currentStep={currentStep}>
      {currentStep === 0 && <ConfigurationStep onComplete={handleStep1Complete} />}
      {currentStep === 1 && <ProcessingStep onComplete={handleStep2Complete} />}
      {currentStep === 2 && <ResultStep onComplete={handleStep3Complete} />}
    </StepperDialog>
  );
};
```

### 9.6.2 共有リソース管理

```typescript
// RelationalEntityManager の実装例
export class SharedResourceManager implements RelationalEntityManager<SharedResourceEntity> {
  async create(data: Omit<SharedResourceEntity, keyof RelationalEntity>): Promise<SharedResourceEntity> {
    // コンテンツハッシュによる重複チェック
    const contentHash = this.calculateContentHash(data);
    const existing = await this.findByContentHash(contentHash);
    
    if (existing) {
      // 既存リソースの参照カウント増加
      await this.addReference(existing.id, data.requestingNodeId);
      return existing;
    }
    
    // 新規リソース作成
    const entity: SharedResourceEntity = {
      id: crypto.randomUUID(),
      referenceCount: 1,
      referencingNodeIds: [data.requestingNodeId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      contentHash,
      ...data,
    };
    
    await this.database.sharedResources.add(entity);
    return entity;
  }
  
  async addReference(entityId: string, nodeId: TreeNodeId): Promise<void> {
    await this.database.transaction('rw', [this.database.sharedResources], async () => {
      const entity = await this.database.sharedResources.get(entityId);
      if (entity && !entity.referencingNodeIds.includes(nodeId)) {
        entity.referenceCount++;
        entity.referencingNodeIds.push(nodeId);
        entity.lastAccessedAt = Date.now();
        await this.database.sharedResources.put(entity);
      }
    });
  }
  
  async removeReference(entityId: string, nodeId: TreeNodeId): Promise<void> {
    await this.database.transaction('rw', [this.database.sharedResources], async () => {
      const entity = await this.database.sharedResources.get(entityId);
      if (entity) {
        entity.referenceCount--;
        entity.referencingNodeIds = entity.referencingNodeIds.filter(id => id !== nodeId);
        
        if (entity.referenceCount <= 0) {
          // 参照カウント0で自動削除
          await this.database.sharedResources.delete(entityId);
        } else {
          await this.database.sharedResources.put(entity);
        }
      }
    });
  }
  
  private calculateContentHash(data: any): string {
    return crypto.subtle.digest('SHA-256', 
      new TextEncoder().encode(JSON.stringify(data))
    ).then(buffer => 
      Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }
}
```

## 9.7 テストとデバッグ

### 9.7.1 ユニットテスト

```typescript
// MyPluginDefinition.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MyPluginDefinition } from '../src/definitions/MyPluginDefinition';
import { AutoLifecycleManager } from '@hierarchidb/worker';

describe('MyPluginDefinition', () => {
  let lifecycleManager: AutoLifecycleManager;
  
  beforeEach(() => {
    lifecycleManager = new AutoLifecycleManager();
    lifecycleManager.registerPlugin(MyPluginDefinition);
  });
  
  it('should create entities automatically', async () => {
    const nodeId = 'test-node-123';
    
    await lifecycleManager.onNodeCreate(nodeId, 'my-plugin');
    
    // PersistentPeerEntityが作成されることを確認
    const entity = await lifecycleManager.getEntity('persistent-peer', 'myPluginEntities', nodeId);
    expect(entity).toBeDefined();
    expect(entity.nodeId).toBe(nodeId);
  });
  
  it('should cleanup ephemeral entities on dialog close', async () => {
    const nodeId = 'test-node-123';
    
    // エンティティ作成
    await lifecycleManager.onNodeCreate(nodeId, 'my-plugin');
    
    // EphemeralGroupEntityが存在することを確認
    let ephemeralEntities = await lifecycleManager.getEntitiesByNode('ephemeral-group', 'myPluginDataEntities', nodeId);
    expect(ephemeralEntities.length).toBeGreaterThan(0);
    
    // ダイアログクローズイベント
    await lifecycleManager.onDialogClose(nodeId, 'my-plugin-dialog');
    
    // EphemeralGroupEntityが削除されることを確認
    ephemeralEntities = await lifecycleManager.getEntitiesByNode('ephemeral-group', 'myPluginDataEntities', nodeId);
    expect(ephemeralEntities.length).toBe(0);
  });
});
```

### 9.7.2 統合テスト

```typescript
// MyPlugin.integration.test.ts
import { describe, it, expect } from 'vitest';
import { createTestDatabase, createTestNodeTypeRegistry } from '@hierarchidb/test-utils';

describe('MyPlugin Integration', () => {
  it('should handle complete workflow', async () => {
    const { db, registry } = await createTestDatabase();
    
    // プラグイン登録
    registry.register(MyPluginDefinition);
    
    // ノード作成
    const nodeId = await registry.createNode('my-plugin', { name: 'Test Node' });
    
    // ワーキングコピー作成
    const workingCopy = await registry.createWorkingCopy(nodeId);
    
    // ワーキングコピー更新
    await registry.updateWorkingCopy(workingCopy.workingCopyId, {
      settings: { option1: 'updated', option2: 42, option3: true }
    });
    
    // ワーキングコピーコミット
    await registry.commitWorkingCopy(workingCopy.workingCopyId);
    
    // 結果確認
    const finalEntity = await registry.getEntity(nodeId);
    expect(finalEntity.settings.option1).toBe('updated');
  });
});
```

## 9.8 ベストプラクティス

### 9.8.1 エンティティ設計

1. **適切な分類選択**
   - データの用途と生存期間を明確にする
   - 不要な複雑性を避ける（PeerEntityで十分な場合はGroupEntityを使わない）

2. **依存関係の最小化**
   - 循環依存を避ける
   - 弱結合を心がける

3. **命名規則の統一**
   - エンティティ名: `{PluginName}Entity`
   - ストア名: `{pluginName}Entities`

### 9.8.2 パフォーマンス最適化

1. **インデックス設計**
   - 頻繁にクエリされるフィールドにインデックスを設定
   - 複合インデックスの適切な使用

2. **トランザクション境界**
   - 関連する操作を同一トランザクションでまとめる
   - 長時間のトランザクションを避ける

3. **メモリ管理**
   - EphemeralEntityの適切な削除設定
   - 大きなデータの圧縮オプション使用

### 9.8.3 エラーハンドリング

1. **バリデーション**
   - 入力データの検証を必須とする
   - 適切なエラーメッセージの提供

2. **リカバリ**
   - 失敗時の自動リトライ機能
   - 部分的な失敗からの復旧

3. **ロギング**
   - 重要な操作のログ記録
   - デバッグ情報の適切な出力

この総合仕様により、HierarchiDBのプラグインシステムは、6分類エンティティシステムと自動ライフサイクル管理を活用した、強力で使いやすい拡張メカニズムを提供します。