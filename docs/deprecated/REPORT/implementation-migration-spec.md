# HierarchiDB プラグイン実装改修仕様書：6分類エンティティシステム移行

## 概要

既存のbasemapとstylemapプラグインを6分類エンティティシステム（Persistent/Ephemeral × Peer/Group/Relational）に移行し、統一されたプラグインアーキテクチャに対応させる。既存の実装を最大限活用しながら、段階的かつ安全な移行を実現する。

## 1. 現状分析

### 1.1 BaseMapプラグイン現状

#### 既存ファイル構造
```
packages/plugins/basemap/
├── plugin.config.ts                 # プラグイン設定
├── src/
│   ├── openstreetmap-type.ts                     # メインエクスポート
│   ├── types/
│   │   ├── BaseMapEntity.ts         # エンティティ型定義
│   │   └── openstreetmap-type.ts                 # 型のエクスポート
│   ├── database/
│   │   └── BaseMapDatabase.ts       # Dexieデータベース
│   ├── handlers/
│   │   ├── BaseMapHandler.ts        # メインハンドラー
│   │   └── BaseMapEntityHandler.ts  # エンティティハンドラー
│   ├── components/                  # UIコンポーネント
│   ├── definitions/
│   │   └── BaseMapDefinition.ts     # プラグイン定義
│   └── ui/
│       └── BaseMapUIPlugin.tsx      # UI層プラグイン
```

#### 現在の実装特徴
- ✅ **PeerEntity相当の実装**: 1:1のTreeNode関係
- ✅ **WorkingCopy対応**: 完全な編集フロー実装済み
- ✅ **Dexieデータベース**: 最適化されたスキーマ
- ✅ **UIコンポーネント**: 作成・編集・プレビューの完全セット
- ⚠️ **従来型定義**: 6分類システム非対応

### 1.2 StyleMapプラグイン現状

#### 既存ファイル構造
```
packages/plugins/stylemap/
├── plugin.config.ts                 # プラグイン設定
├── src/
│   ├── openstreetmap-type.ts                     # メインエクスポート
│   ├── types/
│   │   ├── StyleMapEntity.ts        # PeerEntity実装済み
│   │   ├── TableMetadataEntity.ts   # RelationalEntity実装済み
│   │   ├── StyleMapConfig.ts        # 設定型
│   │   └── openstreetmap-type.ts                 # 型のエクスポート
│   ├── database/
│   │   ├── StyleMapDatabase.ts      # メインデータベース
│   │   └── StyleMapDatabaseOptimization.ts # 最適化
│   ├── handlers/
│   │   ├── StyleMapHandler.ts       # 簡易ハンドラー
│   │   └── StyleMapEntityHandler.ts # フルハンドラー
│   ├── managers/
│   │   └── TableMetadataManager.ts  # RelationalEntity管理
│   ├── components/
│   │   ├── StyleMapImport.tsx       # 6ステップウィザード
│   │   └── steps/                   # ウィザードステップ
│   └── ui/
│       └── StyleMapUIPlugin.tsx     # UI層プラグイン
```

#### 現在の実装特徴
- ✅ **複合エンティティ**: PeerEntity + RelationalEntity
- ✅ **6ステップウィザード**: 完全なインポートフロー
- ✅ **RelationalEntity管理**: 参照カウント実装済み
- ✅ **型合成パターン**: `StyleMapEntity = PeerEntity & StyleMapProperties`
- ⚠️ **6分類システム非統合**: マネージャー分離が不完全

## 2. 移行戦略

### 2.1 移行原則

1. **既存機能保持**: 既存のUI・機能は一切変更せず動作保証
2. **段階的移行**: 各プラグインを独立して移行
3. **後方互換性**: 既存データとAPIの完全互換性維持
4. **テスト駆動**: 各段階で動作確認と回帰テスト実施

### 2.2 移行フェーズ

#### Phase 1: BaseMap移行（1週間）
- 6分類エンティティ対応
- 統一プラグインAPI適用
- 自動ライフサイクル管理統合

#### Phase 2: StyleMap移行（2週間）
- 複合エンティティの6分類統合
- RelationalEntityマネージャー統合
- 6ステップウィザードの統一API対応

#### Phase 3: 統合テスト（1週間）
- プラグイン間連携テスト
- パフォーマンス検証
- 回帰テスト

## 3. BaseMapプラグイン改修詳細

### 3.1 型定義の改修

#### Before: 従来型定義
```typescript
// packages/plugins/basemap/src/types/BaseMapEntity.ts (改修前)
export interface BaseMapEntity extends PeerEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  // ... その他のプロパティ
}
```

#### After: 6分類対応型定義
```typescript
// packages/plugins/basemap/src/types/BaseMapEntity.ts (改修後)
import { PeerEntity, WorkingCopyProperties } from '@hierarchidb/core';

// BaseMap固有プロパティ
export interface BaseMapProperties {
  name: string;
  description?: string;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  styleUrl?: string;
  styleConfig?: any;
  bounds?: [[number, number], [number, number]];
}

// 型合成パターン適用
export type BaseMapEntity = PeerEntity & BaseMapProperties;
export type BaseMapWorkingCopy = BaseMapEntity & WorkingCopyProperties;

// バリデーション関数
export function validateBaseMapEntity(entity: BaseMapEntity): ValidationResult {
  const errors: string[] = [];
  
  if (!entity.name?.trim()) {
    errors.push('Name is required');
  }
  
  const [lng, lat] = entity.center;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    errors.push('Invalid coordinates');
  }
  
  if (entity.zoom < 0 || entity.zoom > 22) {
    errors.push('Zoom must be between 0 and 22');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### 3.2 プラグイン定義の改修

#### Before: 従来プラグイン定義
```typescript
// packages/plugins/basemap/src/definitions/BaseMapDefinition.ts (改修前)
export const BaseMapUnifiedDefinition: PluginDefinition<
  BaseMapEntity,
  never,
  BaseMapWorkingCopy
> = {
  nodeType: 'basemap',
  // ... 従来定義
};
```

#### After: 6分類対応プラグイン定義
```typescript
// packages/plugins/basemap/src/definitions/BaseMapDefinition.ts (改修後)
export const BaseMapWorkerPlugin: WorkerPluginDefinition = {
  nodeType: 'basemap',
  name: 'BaseMap',
  version: '2.0.0',
  
  // 6分類での位置づけ
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'BaseMapEntity',
      manager: 'PeerEntityManager',
      description: '地図設定データ（TreeNodeと1:1対応）'
    }
    // secondaryエンティティはなし（シンプルなプラグイン）
  },
  
  // データベース設定（自動化）
  database: {
    dbName: 'CoreDB',
    entityManagers: {
      'BaseMapEntity': 'PeerEntityManager'
    },
    autoLifecycle: true
  },
  
  // 既存ハンドラーをそのまま利用
  entityHandler: new BaseMapHandler(),
  
  // ライフサイクルフック（簡略化）
  lifecycle: {
    beforeCreate: async (parentId, data) => {
      // 座標検証
      if (data.center) {
        const [lng, lat] = data.center;
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          throw new Error('Invalid coordinates');
        }
      }
    },
    
    afterCreate: async (nodeId, entity) => {
      console.log(`BaseMap created: ${nodeId} - ${entity.name}`);
    }
  },
  
  // バリデーション（簡略化）
  validation: {
    namePattern: /^[a-zA-Z0-9\s\-_\.]+$/,
    maxChildren: 0, // リーフノード
    customValidators: [
      {
        name: 'validCoordinates',
        validate: async (entity) => {
          const validation = validateBaseMapEntity(entity);
          return validation.isValid ? true : validation.errors.join(', ');
        }
      }
    ]
  }
};
```

### 3.3 UIプラグイン定義の改修

#### After: 統一UI定義
```typescript
// packages/plugins/basemap/src/ui/BaseMapUIPlugin.tsx (改修後)
export const BaseMapUIPlugin: UIPluginDefinition = {
  nodeType: 'basemap',
  displayName: 'Base Map',
  
  // 6分類システム対応
  entitySupport: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'BaseMapEntity',
      uiFeatures: {
        supportsWorkingCopy: true,
        supportsVersioning: true,
        supportsExport: true,
        supportsPreview: true,
        customFormFields: [
          { name: 'center', type: 'coordinate', required: true },
          { name: 'zoom', type: 'slider', min: 0, max: 22, required: true },
          { name: 'style', type: 'select', options: mapStyleOptions }
        ]
      }
    }
  },
  
  // 機能定義
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: false,
    supportsWorkingCopy: true,
    supportsEphemeralData: false,
    supportsMultiStep: false,
    supportsBulkOperations: false,
    supportsRelationalEntities: false
  },
  
  // UIコンポーネント（既存をそのまま利用）
  components: {
    icon: BaseMapIcon,
    createDialog: BaseMapCreateDialog,
    editDialog: BaseMapEditDialog,
    detailPanel: BaseMapPanel,
    preview: BaseMapPreview
  },
  
  // アクションフック（既存ロジックの統一API化）
  hooks: {
    beforeCreate: async ({ parentId, formData }) => {
      // 位置情報権限チェック
      const hasPermission = await checkGeolocationPermission();
      if (!hasPermission) {
        return {
          proceed: false,
          message: 'Geolocation permission required for maps'
        };
      }
      return { proceed: true };
    },
    
    afterCreate: async ({ nodeId, entity }) => {
      return {
        navigateTo: nodeId,
        showMessage: `Map "${entity.name}" created successfully`
      };
    },
    
    onFormatDisplay: async ({ combinedData, field }) => {
      if (field === 'coordinates') {
        return `${combinedData.center[1].toFixed(4)}, ${combinedData.center[0].toFixed(4)}`;
      }
      if (field === 'zoom') {
        return `Level ${combinedData.zoom}`;
      }
      return null;
    },
    
    onExport: async ({ nodeId, format }) => {
      const data = await nodeAdapter.getNodeData(nodeId, 'basemap');
      
      if (format === 'geojson') {
        const geoData = convertToGeoJSON(data.entity);
        return new Blob([JSON.stringify(geoData)], { type: 'application/geo+json' });
      }
      
      throw new Error(`Unsupported format: ${format}`);
    }
  },
  
  menu: {
    createOrder: 10,
    group: 'document'
  }
};
```

### 3.4 ハンドラーの改修

既存のBaseMapHandlerは最小限の変更で6分類システムに対応：

```typescript
// packages/plugins/basemap/src/handlers/BaseMapHandler.ts (改修後)
// 既存実装をほぼそのまま維持し、6分類対応の型定義のみ適用

export class BaseMapHandler implements EntityHandler<
  BaseMapEntity,
  never, // GroupEntityなし
  BaseMapWorkingCopy
> {
  // 既存の実装をそのまま維持
  // 型定義の変更により自動的に6分類システム対応
}
```

## 4. StyleMapプラグイン改修詳細

### 4.1 型定義の改修

#### After: 6分類対応型定義
```typescript
// packages/plugins/stylemap/src/types/StyleMapEntity.ts (改修後)
import { PeerEntity, RelationalEntity, WorkingCopyProperties } from '@hierarchidb/core';

// StyleMap固有プロパティ
export interface StyleMapProperties {
  name: string;
  description?: string;
  filename?: string;
  keyColumn?: string;
  valueColumns?: string[];
  styleMapConfig?: StyleMapConfig;
  filterRules?: FilterRule[];
  tableMetadataId?: string; // RelationalEntityへの参照
  cacheKey?: string;
  lastProcessed?: number;
}

// 型合成パターン適用
export type StyleMapEntity = PeerEntity & StyleMapProperties;
export type StyleMapWorkingCopy = StyleMapEntity & WorkingCopyProperties;

// RelationalEntity（既存実装をそのまま活用）
export interface TableMetadataProperties {
  filename: string;
  columns: string[];
  rowCount: number;
  checksum: string;
  lastAccessedAt: number;
}

export type TableMetadataEntity = RelationalEntity & TableMetadataProperties;
```

### 4.2 プラグイン定義の改修

#### After: 複合エンティティ対応
```typescript
// packages/plugins/stylemap/src/definitions/StyleMapDefinition.ts (改修後)
export const StyleMapWorkerPlugin: WorkerPluginDefinition = {
  nodeType: 'stylemap',
  name: 'StyleMap',
  version: '2.0.0',
  
  // 6分類での位置づけ（複数エンティティ利用）
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'StyleMapEntity',
      manager: 'PeerEntityManager',
      description: 'スタイル設定（TreeNodeと1:1対応）'
    },
    secondary: [{
      category: 'PersistentRelationalEntity',
      entityType: 'TableMetadataEntity',
      manager: 'RelationalEntityManager',
      description: 'テーブルメタデータ（複数StyleMapで共有、N:N関係）'
    }]
  },
  
  // データベース設定（自動化）
  database: {
    dbName: 'CoreDB',
    entityManagers: {
      'StyleMapEntity': 'PeerEntityManager',
      'TableMetadataEntity': 'RelationalEntityManager'
    },
    autoLifecycle: true,
    relations: [{
      entityType: 'TableMetadataEntity',
      manager: 'RelationalEntityManager',
      referenceField: 'tableMetadataId'
    }]
  },
  
  // 既存ハンドラーをそのまま利用
  entityHandler: new StyleMapHandler(),
  
  // ライフサイクルフック（既存実装をそのまま活用）
  lifecycle: stylemapLifecycle, // 既存のライフサイクルフック
  
  // バリデーション（既存実装をそのまま活用）
  validation: {
    namePattern: /^[a-zA-Z0-9\s\-_\.]+$/,
    maxChildren: 0,
    customValidators: stylemapValidators // 既存のバリデーター
  }
};
```

### 4.3 UIプラグイン定義の改修

#### After: マルチステップ対応UI定義
```typescript
// packages/plugins/stylemap/src/ui/StyleMapUIPlugin.tsx (改修後)
export const StyleMapUIPlugin: UIPluginDefinition = {
  nodeType: 'stylemap',
  displayName: 'Style Map',
  
  // 6分類システム対応（複合エンティティ）
  entitySupport: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'StyleMapEntity',
      uiFeatures: {
        supportsWorkingCopy: true,
        supportsVersioning: true,
        supportsExport: true,
        supportsPreview: true
      }
    },
    secondary: [{
      category: 'PersistentRelationalEntity',
      entityType: 'TableMetadataEntity',
      uiFeatures: {
        supportsWorkingCopy: false,
        supportsVersioning: true
      }
    }]
  },
  
  // 機能定義
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: false,
    supportsWorkingCopy: true,
    supportsEphemeralData: false,
    supportsMultiStep: true, // 6ステップウィザード
    supportsBulkOperations: false,
    supportsRelationalEntities: true
  },
  
  // UIコンポーネント（既存をそのまま利用）
  components: {
    icon: StyleMapIcon,
    multiStepDialog: StyleMapImport, // 既存の6ステップウィザード
    editDialog: StyleMapEditDialog,
    preview: StyleMapPreview
  },
  
  // アクションフック（6ステップウィザード統合）
  hooks: {
    onShowCreateDialog: async ({ parentId, onSubmit }) => {
      // 既存の6ステップウィザードを統一API経由で表示
      await showMultiStepDialog({
        component: StyleMapImport,
        steps: 6,
        onComplete: onSubmit
      });
    },
    
    afterCreate: async ({ nodeId, entity }) => {
      return {
        navigateTo: nodeId,
        showMessage: `StyleMap "${entity.name}" imported successfully`
      };
    },
    
    onExport: async ({ nodeId, format }) => {
      const data = await nodeAdapter.getNodeData(nodeId, 'stylemap');
      
      if (format === 'csv') {
        const csvData = await exportStyleMapAsCSV(data);
        return new Blob([csvData], { type: 'text/csv' });
      }
      
      throw new Error(`Unsupported format: ${format}`);
    }
  },
  
  menu: {
    createOrder: 20,
    group: 'document'
  }
};
```

## 5. 自動ライフサイクル管理の統合

### 5.1 エンティティマネージャー登録

```typescript
// packages/worker/src/plugins/PluginRegistration.ts (新規)
import { AutoEntityLifecycleManager } from '@hierarchidb/core';
import { BaseMapWorkerPlugin } from '@hierarchidb/plugin-basemap';
import { StyleMapWorkerPlugin } from '@hierarchidb/plugin-stylemap';

const lifecycleManager = AutoEntityLifecycleManager.getInstance();

// プラグイン登録時に自動ライフサイクル管理を設定
lifecycleManager.registerPlugin(BaseMapWorkerPlugin);
lifecycleManager.registerPlugin(StyleMapWorkerPlugin);

// TreeNode削除時の自動クリーンアップが有効化される
// WorkingCopy削除時の自動クリーンアップが有効化される
// RelationalEntityの参照カウント管理が有効化される
```

### 5.2 既存データベースとの互換性

```typescript
// packages/plugins/basemap/src/database/BaseMapDatabase.ts (改修後)
export class BaseMapDatabase extends Dexie {
  // 既存のテーブル定義をそのまま維持
  entities!: Table<BaseMapEntity, TreeNodeId>;
  workingCopies!: Table<BaseMapWorkingCopy, string>;
  
  constructor() {
    super('BaseMapDB');
    
    // 既存のスキーマをそのまま維持（後方互換性）
    this.version(1).stores({
      entities: 'nodeId, name, center, zoom, updatedAt',
      workingCopies: 'workingCopyId, nodeId, workingCopyOf'
    });
    
    // 6分類システム対応のフック追加
    this.entities.hook('creating', function(primKey, obj) {
      // PeerEntityマネージャーとの連携
      obj.createdAt = Date.now();
      obj.updatedAt = Date.now();
    });
  }
}
```

### 5.3 RelationalEntityの自動管理

```typescript
// packages/plugins/stylemap/src/managers/TableMetadataManager.ts (改修後)
export class TableMetadataManager extends RelationalEntityManager<TableMetadataEntity> {
  constructor() {
    super();
    // 既存の実装をRelationalEntityManagerの仕組みに統合
  }
  
  // 既存メソッドをそのまま維持しつつ、自動ライフサイクル管理を統合
  async addReference(entityId: string, nodeId: TreeNodeId): Promise<void> {
    // 既存の参照カウント実装を活用
    await super.addReference(entityId, nodeId);
    
    // 既存の TableMetadataManager ロジックも実行
    await this.updateLastAccessed(entityId);
  }
  
  async removeReference(entityId: string, nodeId: TreeNodeId): Promise<void> {
    // 自動削除ロジック
    await super.removeReference(entityId, nodeId);
    
    // 参照カウントが0になったら追加のクリーンアップ
    const entity = await this.get(entityId);
    if (!entity) {
      // 関連するキャッシュデータも削除
      await this.cleanupRelatedCache(entityId);
    }
  }
}
```

## 6. 段階的移行手順

### 6.1 Phase 1: BaseMap移行（1週間）

#### Day 1-2: 型定義改修
1. `BaseMapEntity.ts`を型合成パターンに変更
2. `validateBaseMapEntity`関数の追加
3. 既存コードとの互換性確認

#### Day 3-4: プラグイン定義改修
1. `BaseMapDefinition.ts`を6分類システム対応
2. `BaseMapUIPlugin.tsx`を統一API対応
3. 自動ライフサイクル管理の統合

#### Day 5-7: テストと検証
1. 既存機能の動作確認
2. 新しいライフサイクル管理の検証
3. パフォーマンステスト

### 6.2 Phase 2: StyleMap移行（2週間）

#### Week 1: 複合エンティティ対応
1. `StyleMapEntity.ts`と`TableMetadataEntity.ts`の改修
2. 複合エンティティ定義の追加
3. RelationalEntityManager統合

#### Week 2: UI統合とテスト
1. 6ステップウィザードの統一API統合
2. マルチステップ処理フレームワーク適用
3. 包括的な動作テスト

### 6.3 Phase 3: 統合テスト（1週間）

#### 統合検証項目
1. **機能互換性**: 既存の全機能が正常動作
2. **データ互換性**: 既存データの正常読み込み・操作
3. **パフォーマンス**: 従来と同等以上の性能
4. **UI一貫性**: 統一されたプラグインUX
5. **ライフサイクル**: 自動管理の正常動作

## 7. リスク管理と対策

### 7.1 技術的リスク

#### リスク1: 既存データ破損
**対策**: 
- 移行前の完全バックアップ
- 段階的移行でのロールバック可能性確保
- データベーススキーマの後方互換性維持

#### リスク2: パフォーマンス劣化
**対策**:
- 各段階でのベンチマーク測定
- 既存最適化の保持
- 新しいインデックス戦略の適用

#### リスク3: 機能回帰
**対策**:
- 包括的な回帰テストスイート
- 既存UIコンポーネントの完全保持
- API互換性レイヤーの提供

### 7.2 開発リスク

#### リスク1: 移行期間の長期化
**対策**:
- 明確なマイルストーンとタスク分割
- 並行開発可能な部分の特定
- 定期的な進捗確認

#### リスク2: 既存コードとの競合
**対策**:
- 移行中の変更フリーズ
- ブランチ戦略の明確化
- チーム間のコミュニケーション強化

## 8. 成功基準

### 8.1 技術的成功基準

1. **完全互換性**: 既存の全機能が正常動作
2. **性能維持**: 従来比95%以上の性能維持
3. **データ整合性**: 既存データの100%正常読み込み
4. **自動化**: ライフサイクル管理の自動化動作確認

### 8.2 体験的成功基準

1. **操作感統一**: 全プラグインで一貫したCRUD UX
2. **学習コスト**: 既存ユーザーの追加学習不要
3. **開発効率**: 新プラグイン開発時間50%短縮
4. **保守性**: バグ修正・機能追加の容易性向上

## 9. まとめ

この改修仕様により、既存のbasemapとstylemapプラグインを6分類エンティティシステムに安全かつ効率的に移行できる。

### ✅ **移行の利点**
1. **統一されたアーキテクチャ**: 全プラグインで一貫した設計
2. **自動ライフサイクル管理**: エンティティ管理の自動化
3. **開発効率向上**: 統一APIによる開発体験改善
4. **将来への対応**: Shapesプラグインなど高度な機能への対応基盤

### ✅ **リスク最小化**
1. **既存機能保持**: 100%の後方互換性
2. **段階的移行**: 各フェーズでの検証とロールバック可能性
3. **データ保護**: 既存データの完全保護
4. **性能維持**: 最適化された実装の継続利用

### ✅ **実装可能性**
1. **現実的なスケジュール**: 4週間での完全移行
2. **明確なタスク分割**: 各フェーズの具体的作業内容
3. **技術的実現性**: 既存実装の最大活用
4. **チーム実行力**: 段階的かつ並行可能な作業配分

この改修により、HierarchiDBは技術的合理性と開発効率を両立した次世代プラグインシステムへと進化する。