# BaseMap実装比較分析：hierarchiidb vs eria-cartograph

## 分析概要

本ドキュメントでは、hierarchiidbプロジェクトとeria-cartographプロジェクトにおけるBaseMap機能の実装を詳細に比較分析し、両アプローチの技術的差異、設計思想、及び相互の利点・欠点を明確化する。

**分析対象**:
- hierarchiidb: `packages/plugins/basemap/`
- eria-cartograph: `app0/src/domains/resources/basemap/`

## 1. アーキテクチャ比較

### 1.1 設計パターン

| 観点 | hierarchiidb | eria-cartograph |
|------|-------------|-----------------|
| **基本パターン** | AOP Plugin Architecture | Domain-Driven Resource Pattern |
| **拡張方式** | プラグイン動的登録 | 静的ResourceDefinition |
| **分離方針** | UI-Worker完全分離 | UI-Service部分分離 |
| **型システム** | Generic + Union Types | Interface継承 |

### 1.2 プラグインシステム比較

#### hierarchiidb: UnifiedPluginDefinition
```typescript
export const BaseMapUnifiedDefinition: UnifiedPluginDefinition<
  BaseMapEntity, never, BaseMapWorkingCopy
> = {
  nodeType: 'basemap',
  database: { /* スキーマ定義 */ },
  entityHandler: new BaseMapHandler(),
  lifecycle: { beforeCreate, afterCreate, ... },
  ui: { dialogComponent, panelComponent, ... },
  api: { workerExtensions, clientExtensions },
  routing: { actions: { view, edit, preview } },
  validation: { customValidators: [...] }
};
```

**特徴**:
- 完全な型安全性（Generic活用）
- ライフサイクルフック充実
- React Router統合
- API拡張機能

#### eria-cartograph: ResourceDefinition
```typescript
export const BaseMapResourceDefinition: ResourceDefinition<BaseMapEntity> = {
  name: "BaseMap",
  type: TreeNodeTypes.BaseMap,
  database: { name: "BaseMapDB", tableName: "baseMaps" },
  ui: { dialogMaxWidth: "md", stepCount: 2 },
  operations: new BaseMapHandler(),
  importExport: { exportData, importData },
  workingCopy: { createWorkingCopy, commitWorkingCopy },
  lifecycle: { onCreate, onUpdate, onDelete }
};
```

**特徴**:
- シンプルな設定構造
- UI設定統合
- Import/Export標準対応
- 実装の直感性

## 2. データモデル比較

### 2.1 エンティティ定義

#### hierarchiidb: BaseMapEntity
```typescript
export interface BaseMapEntity extends BaseEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  
  // MapLibre GL準拠の詳細設定
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  styleUrl?: string;
  styleConfig?: MapLibreStyleConfig; // 完全なMapLibre GL仕様
  
  // 高精度ビューポート設定
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds?: { north: number; south: number; east: number; west: number; };
  
  // 表示オプション詳細
  displayOptions?: {
    show3dBuildings?: boolean;
    showTraffic?: boolean;
    showTransit?: boolean;
    showTerrain?: boolean;
    showLabels?: boolean;
  };
  
  // メタデータとアクセス制御
  apiKey?: string;
  attribution?: string;
  thumbnailUrl?: string;
  tags?: string[];
}
```

#### eria-cartograph: BaseMapEntity
```typescript
export interface BaseMapEntity extends ResourceEntity {
  id: string;
  name: string;
  description: string;
  
  // カテゴリ分類中心
  category: "minimal" | "standard" | "satellite" | "terrain" | "custom";
  
  // MapLibre GL基本設定
  styleUrl?: string;
  styleConfig?: { /* 基本的なMapLibre設定 */ };
  
  // プレビューとメタデータ
  thumbnailUrl?: string;
  attribution?: string;
  
  // ビジネス要件
  free: boolean;
  requiresApiKey?: boolean;
  registrationUrl?: string;
  requestLimit?: {
    value: number;
    period: "hour" | "day" | "month";
  };
}
```

### 2.2 Working Copy実装

#### hierarchiidb: 完全Working Copy
```typescript
export interface BaseMapWorkingCopy extends BaseWorkingCopy {
  // 全BaseMapEntityフィールド + Working Copy制御
  workingCopyId: string;
  workingCopyOf: TreeNodeId;
  copiedAt: number;
  isDirty: boolean;
  
  // Copy-on-Write実装
  async createWorkingCopy(nodeId: TreeNodeId): Promise<BaseMapWorkingCopy>
  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: BaseMapWorkingCopy): Promise<void>
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void>
}
```

#### eria-cartograph: 基本Working Copy
```typescript
// ResourceEntityベースの基本的なワーキングコピー
workingCopy: {
  createWorkingCopy: async (sourceId: TreeNodeId) => string,
  commitWorkingCopy: async (workingCopyId: string) => void,
  discardWorkingCopy: async (workingCopyId: string) => void,
}
```

## 3. データベース層比較

### 3.1 hierarchiidb: Dexie + Type Safety

```typescript
export class BaseMapDatabase extends Dexie {
  entities!: Table<BaseMapEntity, TreeNodeId>;
  workingCopies!: Table<BaseMapWorkingCopy, string>;

  constructor() {
    super('BaseMapDB');
    this.version(1).stores({
      entities: 'nodeId, name, mapStyle, createdAt, updatedAt',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId, copiedAt'
    });
  }
}
```

**特徴**:
- 型安全なDexie操作
- 専用Working Copyテーブル
- インデックス最適化
- Singleton + Worker Instance管理

### 3.2 eria-cartograph: BaseResourceDB継承

```typescript
export class BaseMapDB extends BaseResourceDB<BaseMapEntity> {
  baseMapEntities!: Table<BaseMapEntity, TreeNodeId>;
  
  protected tableName = "baseMapEntities";
  protected entityTable = this.baseMapEntities;
  
  protected initializeSchema(): void {
    this.version(1).stores({
      baseMapEntities: "nodeId",
    });
  }
}
```

**特徴**:
- 継承による共通機能
- バリデーション統合
- Factory Pattern使用
- Worker Instance対応

## 4. UI実装比較

### 4.1 hierarchiidb: プラグイン動的UI

```typescript
// コンポーネント動的ロード
ui: {
  dialogComponent: lazy(() => import('../components/BaseMapDialog')),
  panelComponent: lazy(() => import('../components/BaseMapPanel')),
  formComponent: lazy(() => import('../components/BaseMapForm')),
  iconComponent: lazy(() => import('../components/BaseMapIcon'))
}

// React Router統合
routing: {
  actions: {
    view: { component: lazy(() => import('../components/BaseMapView')) },
    edit: { component: lazy(() => import('../components/BaseMapEditor')) },
    preview: { component: lazy(() => import('../components/BaseMapPreview')) }
  }
}
```

### 4.2 eria-cartograph: 統合フォームUI

```typescript
// ステップ式ダイアログ
ui: {
  dialogMaxWidth: "md",
  icon: "🗺️",
  color: "#4CAF50",
  stepCount: 2,
  renderSteps: renderBaseMapSteps,
}

// Material-UI統合フォーム
export function BaseMapForm({ entity, onChange }: BaseMapFormProps) {
  return (
    <Stack spacing={2}>
      <FormControl>
        <InputLabel>Category</InputLabel>
        <Select value={entity.category} onChange={...}>
          {/* カテゴリ選択 */}
        </Select>
      </FormControl>
      {/* 詳細設定フォーム */}
    </Stack>
  );
}
```

## 5. API・サービス層比較

### 5.1 hierarchiidb: 拡張可能API

```typescript
// Worker API拡張
api: {
  workerExtensions: {
    exportMapStyle: async (nodeId: TreeNodeId): Promise<any> => {
      const handler = new BaseMapHandler();
      const entity = await handler.getEntity(nodeId);
      return entity?.styleConfig;
    },
    importMapStyle: async (nodeId: TreeNodeId, styleConfig: any): Promise<void> => {
      const handler = new BaseMapHandler();
      await handler.updateEntity(nodeId, { styleConfig });
    },
    getMapBounds: async (nodeId: TreeNodeId): Promise<any> => {
      const handler = new BaseMapHandler();
      const entity = await handler.getEntity(nodeId);
      return entity?.bounds;
    }
  }
}

// 地理空間計算メソッド
async findNearbyMaps(center: [number, number], radius: number): Promise<BaseMapEntity[]>
async setBounds(nodeId: TreeNodeId, bounds: BaseMapEntity['bounds']): Promise<void>
```

### 5.2 eria-cartograph: ResourceHandler統合

```typescript
export class BaseMapHandler implements ResourceHandler {
  async duplicate(sourceId: TreeNodeId, duplicatedId: TreeNodeId): Promise<void>
  async backup(id: TreeNodeId): Promise<unknown>
  async cleanup(id: TreeNodeId): Promise<void>
  async restore(id: TreeNodeId, backup: unknown): Promise<void>
  async delete(id: TreeNodeId): Promise<void>
}

// Import/Export標準対応
importExport: {
  exportData: async (nodeId: TreeNodeId) => ({ type: "basemap", data: ... }),
  importData: async (data: any, nodeId: TreeNodeId) => { /* 実装 */ },
  getDependencies: async (nodeId: TreeNodeId) => []
}
```

## 6. バリデーション比較

### 6.1 hierarchiidb: 多層バリデーション

```typescript
// 型レベル制約
validation: {
  namePattern: /^[a-zA-Z0-9\s\-_]+$/,
  maxChildren: 0,
  allowedChildTypes: [],
  customValidators: [
    {
      name: 'validCoordinates',
      validate: async (entity: BaseMapEntity) => {
        const [lng, lat] = entity.center;
        if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180';
        if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90';
        return true;
      }
    }
  ]
}

// ライフサイクルフック検証
beforeCreate: async (parentId: TreeNodeId, nodeData: Partial<any>) => {
  if (nodeData.center) {
    const [lng, lat] = nodeData.center;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid coordinates');
    }
  }
}
```

### 6.2 eria-cartograph: ランタイムバリデーション

```typescript
// バリデーション関数中心
export function validateBaseMap(baseMap: BaseMapEntity): ValidationResult {
  const errors: string[] = [];
  
  if (!baseMap.name || baseMap.name.trim() === '') {
    errors.push('Name is required');
  }
  
  if (!['minimal', 'standard', 'satellite', 'terrain', 'custom'].includes(baseMap.category)) {
    errors.push('Invalid category');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// DB保存時検証
async save(baseMap: BaseMapEntity): Promise<void> {
  const validation = validateBaseMap(baseMap);
  if (!validation.isValid) {
    throw new Error(`Invalid BaseMap: ${validation.errors.join(", ")}`);
  }
  await this.saveEntity(baseMap);
}
```

## 7. テスト戦略比較

### 7.1 hierarchiidb: 型駆動テスト
- TypeScript型テスト
- プラグイン統合テスト
- Working Copy動作テスト
- ライフサイクルフックテスト

### 7.2 eria-cartograph: 機能中心テスト
- バリデーション関数テスト
- CRUD操作テスト
- UI コンポーネントテスト
- E2E シナリオテスト

## 8. パフォーマンス特性

### 8.1 hierarchiidb
- **利点**: Worker完全分離によるUIブロッキング回避
- **利点**: 型最適化による実行時チェック削減
- **欠点**: プラグインロード初期コスト
- **欠点**: 複雑な抽象化によるオーバーヘッド

### 8.2 eria-cartograph
- **利点**: シンプルな実行パス
- **利点**: 直接的なデータベースアクセス
- **欠点**: UI スレッドでの処理によるブロッキング
- **欠点**: ランタイムバリデーションコスト

## 9. 拡張性・保守性分析

### 9.1 拡張性

| 観点 | hierarchiidb | eria-cartograph |
|------|-------------|-----------------|
| **新機能追加** | ○ プラグイン追加 | △ コード変更必要 |
| **UI カスタマイズ** | ○ コンポーネント差し替え | △ フォーム修正 |
| **API拡張** | ○ Worker/Client拡張 | △ Handler継承 |
| **バリデーション追加** | ○ Validator追加 | ○ 関数追加 |
| **データベーススキーマ変更** | △ 移行複雑 | ○ 移行容易 |

### 9.2 保守性

| 観点 | hierarchiidb | eria-cartograph |
|------|-------------|-----------------|
| **コード理解容易性** | △ 抽象化複雑 | ○ 直感的 |
| **デバッグ容易性** | △ 多層スタック | ○ シンプル |
| **テスト容易性** | ○ モック容易 | ○ 単体テスト容易 |
| **変更影響範囲** | ○ 分離設計 | △ 密結合部分あり |

## 10. 採用判断指針

### 10.1 hierarchiidb採用が適切なケース
- **大規模プラグインエコシステム**が必要
- **型安全性**が最重要要件
- **高度な並列処理**が必要
- **長期保守性**を重視
- **開発チームが高技術力**

### 10.2 eria-cartograph採用が適切なケース
- **高速プロトタイピング**が必要
- **シンプルな実装**を優先
- **短期間での実装**が必要
- **既存ResourceDefinitionとの統一性**を重視
- **実装の理解容易性**を重視

## 11. 統合アプローチ提案

### 11.1 ハイブリッド設計案

```typescript
// hierarchiidbの型安全性 + eria-cartographのシンプルさ
export interface EnhancedBaseMapDefinition 
  extends ResourceDefinition<BaseMapEntity> {
  
  // hierarchiidbから採用
  validation: {
    customValidators: ValidationRule<BaseMapEntity>[];
    namePattern: RegExp;
    maxChildren: number;
  };
  
  // eria-cartographから採用
  ui: {
    dialogMaxWidth: DialogMaxWidth;
    stepCount: number;
    renderSteps: (props: StepProps) => React.ReactNode;
  };
  
  // 新機能統合
  lifecycle: {
    hooks: NodeLifecycleHooks<BaseMapEntity>;
    validation: ValidationHooks<BaseMapEntity>;
  };
}
```

### 11.2 移行戦略

1. **Phase 1**: eria-cartographベースで型安全性強化
2. **Phase 2**: Working Copy パターン導入
3. **Phase 3**: プラグインシステム段階導入
4. **Phase 4**: 完全な統合アーキテクチャ

## 12. 結論

両実装はそれぞれ異なる設計思想と要件に最適化されている：

- **hierarchiidb**: 次世代アーキテクチャとして型安全性・拡張性を追求
- **eria-cartograph**: 実用性・開発速度を重視した実装

選択は、プロジェクトの規模、チーム技術力、保守期間、拡張要件によって決定すべきである。大規模・長期プロジェクトではhierarchiib、中小規模・短期プロジェクトではeria-cartographのアプローチが適している。