## 10.1 プラグイン: basemap（基本地図）

本章では、6章/7章/8章/11章で示した統合プラグイン設計（UnifiedPluginDefinition と NodeTypeRegistry、ルーティング統合）に基づき、basemap プラグインの仕様と画面・API 契約、設計・実装方針をまとめる。なお、本リポジトリには packages/plugins/basemap として実装が存在するため（Unified 定義・DB・UI 含む）、ここでは実装の要点を要約しつつ、統合上の確認事項や不整合点を TODO として明示する。

- 参照ドキュメント
  - 6章: docs/6-plugin-modules.md
  - 7章: docs/7-aop-architecture.md
  - 8章: docs/8-plugin-routing-system.md
  - 11章: docs/11-plugin-ui.md

### 10.1.1 概要
- 目的: MapLibre GL JS で表示する「基本地図（Base Map）」リソースを管理・表示する。
- Tree: Resources ツリー配下のノードタイプ。
- NodeType: `basemap`
- 代表的なユースケース:
  - 基本地図スタイル（style URL または JSON）、初期表示位置（中心座標・ズーム）等を保存
  - プロジェクト（project プラグイン）に参照され、統合表示のベースレイヤーになる

### 10.1.2 データモデル（Entity / Working Copy）
- Entity: BaseMapEntity（例）
  - id: string
  - name: string
  - style: string | URL | JSON
  - center: [lng: number, lat: number]
  - zoom: number
  - bearing?: number
  - pitch?: number
  - createdAt: number
  - updatedAt: number
- WorkingCopy: BaseMapWorkingCopy（例）
  - 編集中の一時状態。5章の working copy モデルに準拠。

注意: 具体の型定義は 6章の例示をベースにするが、実装時に core 型群と整合させること。

### 10.1.3 UnifiedPluginDefinition（想定）
6章/11章の例に準拠。

```ts
export const BaseMapUnifiedDefinition: UnifiedPluginDefinition<BaseMapEntity, never, BaseMapWorkingCopy> = {
  nodeType: 'basemap',
  name: 'BaseMap',
  displayName: 'Base Map',
  database: { entityStore: 'basemaps', schema: {}, version: 1 },
  entityHandler: new BaseMapHandler(),
  lifecycle: { afterCreate, beforeDelete },
  routing: {
    actions: {
      view: { component: lazy(() => import('../ui/MapView')), displayName: 'Map View' },
      edit: { component: lazy(() => import('../ui/MapEditor')), displayName: 'Map Editor' }
    },
    defaultAction: 'view'
  },
  meta: {
    version: '1.0.0',
    description: 'MapLibreGLJSで表示する基本的な地図を提供',
    tags: ['map', 'resources', 'visualization']
  }
};
```

### 10.1.4 ルーティングと UI
- 外部仕様 URL（8.1章）: `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?`
- basemap の例:
  - 一覧（フォルダ内）はフォルダ機能に依存
  - 表示: `/t/:treeId/.../basemap/view`
  - 編集: `/t/:treeId/.../basemap/edit`
- レンダリング: 9章の説明どおり、`treeNodeType='basemap'` と `action` に応じて Registry 経由で UI コンポーネントを取得・レンダリング。
- 想定 UI コンポーネント
  - MapView: 読み取り専用の表示
  - MapEditor: スタイル URL/JSON、中心、ズーム等を編集

### 10.1.5 LoaderData と必要データ
- 9章の LoaderData 契約を使用。
  - treeContext（ツリー情報）
  - targetNode（操作対象のノード）
  - pluginData（プラグイン独自）
- basemap の pluginData 例
  - entity: BaseMapEntity
  - resolvedStyle: レンダリングに用いる実スタイル URL / JSON

### 10.1.6 Worker/API 拡張
- 6章での方針:
  - WorkerAPIExtensions にて basemap エンティティの CRUD、スタイル検証、参照整合性チェックを提供可能。
- 例（概念）
  - getBaseMap(id) / saveBaseMap(entity) / deleteBaseMap(id)
  - validateStyle(style): スタイル URL/JSON の検証

### 10.1.7 ライフサイクルフック
- afterCreate: 新規ノード作成時にデフォルトのスタイルや初期表示をセット
- beforeDelete: 参照整合性（project等から参照中の場合の警告/ブロック）

### 10.1.8 権限
- 9章の認証/権限と統合。編集系は適切なロール/スコープが必要。

### 10.1.9 受け入れ基準（サマリ）
- NodeTypeRegistry に `basemap` 定義が登録できる
- `/t/.../basemap/view` と `/t/.../basemap/edit` で UI が動的ロード
- Entity の保存・読み込み（IndexedDB/Dexie 想定）が可能
- プロジェクトからの参照に耐える（将来拡張）

### 10.1.10 TODO（仕様の不備・設計の矛盾・未実装）
- 実装確認済み: `packages/plugins/basemap` に Unified 定義・DB・UI が存在
  - 対応: 実装要点のドキュメント反映と、アプリ側ルーティング（11章）との動作確認を継続
- NodeTypeRegistry/UnifiedPluginDefinition のアプリ統合検証未了（7章は文書、実配線は要確認）
  - 対応: core/worker/ui の各層からレジストリ参照を実機確認し、動的レンダリングを E2E で検証
- MapView/MapEditor の具象 UI の要件化（現状コンポーネントはあるが UX 要件は未定義）
  - 対応: 11章のルータ連携に基づく最小 UX 要件を定義
- スタイルの型（URL/JSON）と検証 API のエラーモデル未確定
  - 対応: `validateStyle` の仕様（同期/非同期、エラーコード）を策定
- 参照整合性（project からの参照保護）
  - 対応: beforeDelete での参照カウントチェック仕様を策定

### 10.1.11 具体的な実装例：BaseMapノードタイプ

#### BaseMapエンティティ定義

```typescript
// packages/plugins/basemap/src/types/BaseMapEntity.ts

export interface BaseMapEntity extends BaseEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain';
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

export interface BaseMapWorkingCopy extends BaseWorkingCopy {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain';
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  workingCopyId: UUID;
  workingCopyOf: TreeNodeId;
  copiedAt: Timestamp;
  isDirty: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}
```

### 10.1.12 BaseMapハンドラー実装

```typescript
// packages/plugins/basemap/src/handlers/BaseMapHandler.ts

export class BaseMapHandler implements EntityHandler<
  BaseMapEntity,
  never,
  BaseMapWorkingCopy
> {
  private db: BaseMapDatabase;
  
  constructor(db: BaseMapDatabase) {
    this.db = db;
  }
  
  async createEntity(
    nodeId: TreeNodeId,
    data?: Partial<BaseMapEntity>
  ): Promise<BaseMapEntity> {
    const entity: BaseMapEntity = {
      nodeId,
      name: data?.name || 'New BaseMap',
      description: data?.description,
      mapStyle: data?.mapStyle || 'streets',
      center: data?.center || [0, 0],
      zoom: data?.zoom || 10,
      bearing: data?.bearing || 0,
      pitch: data?.pitch || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    await this.db.entities.add(entity);
    return entity;
  }
  
  async getEntity(nodeId: TreeNodeId): Promise<BaseMapEntity | undefined> {
    return await this.db.entities.get(nodeId);
  }
  
  async updateEntity(
    nodeId: TreeNodeId,
    data: Partial<BaseMapEntity>
  ): Promise<void> {
    await this.db.entities.update(nodeId, {
      ...data,
      updatedAt: Date.now(),
      version: (data.version || 0) + 1
    });
  }
  
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    await this.db.entities.delete(nodeId);
  }
  
  async createWorkingCopy(nodeId: TreeNodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }
    
    const workingCopy: BaseMapWorkingCopy = {
      ...entity,
      workingCopyId: generateUUID(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false
    };
    
    await this.db.workingCopies.add(workingCopy);
    return workingCopy;
  }
  
  async commitWorkingCopy(
    nodeId: TreeNodeId,
    workingCopy: BaseMapWorkingCopy
  ): Promise<void> {
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy;
    
    await this.updateEntity(nodeId, entityData);
    await this.db.workingCopies.delete(workingCopy.workingCopyId);
  }
  
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    const workingCopy = await this.db.workingCopies
      .where('workingCopyOf')
      .equals(nodeId)
      .first();
    
    if (workingCopy) {
      await this.db.workingCopies.delete(workingCopy.workingCopyId);
    }
  }
  
  async duplicate(
    nodeId: TreeNodeId,
    newNodeId: TreeNodeId
  ): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) return;
    
    await this.createEntity(newNodeId, {
      ...entity,
      nodeId: newNodeId,
      name: `${entity.name} (Copy)`
    });
  }
}
```

### 10.1.13 BaseMapノードタイプ定義

```typescript
// packages/plugins/basemap/src/definitions/BaseMapDefinition.ts

export const BaseMapNodeDefinition: NodeTypeDefinition<
  BaseMapEntity,
  never,
  BaseMapWorkingCopy
> = {
  nodeType: 'basemap' as TreeNodeType,
  name: 'BaseMap',
  displayName: 'Base Map',
  icon: 'map',
  color: '#4CAF50',
  
  database: {
    entityStore: 'basemaps',
    schema: {
      basemaps: '&nodeId, name, mapStyle, updatedAt',
      workingCopies: '&workingCopyId, workingCopyOf, copiedAt'
    },
    version: 1
  },
  
  entityHandler: new BaseMapHandler(BaseMapDB.getInstance()),
  
  lifecycle: {
    afterCreate: async (nodeId: TreeNodeId, entity: BaseMapEntity) => {
      console.log(`BaseMap created: ${nodeId}`, entity);
      // 追加の初期化処理
    },
    
    beforeDelete: async (nodeId: TreeNodeId) => {
      // 削除前のクリーンアップ処理
      console.log(`Cleaning up BaseMap: ${nodeId}`);
    }
  },
  
  ui: {
    dialogComponent: lazy(() => import('../ui/BaseMapDialog')),
    panelComponent: lazy(() => import('../ui/BaseMapPanel')),
    formComponent: lazy(() => import('../ui/BaseMapForm'))
  },
  
  api: {
    workerExtensions: {
      getMapPreview: async (nodeId: TreeNodeId): Promise<{ url: string; thumbnail: string }> => {
        // マッププレビュー生成
        return { url: '', thumbnail: '' };
      },
      exportMapConfig: async (nodeId: TreeNodeId): Promise<BaseMapEntity> => {
        // マップ設定のエクスポート
        const handler = new BaseMapHandler(BaseMapDB.getInstance());
        const entity = await handler.getEntity(nodeId);
        if (!entity) throw new Error(`Entity not found: ${nodeId}`);
        return entity;
      }
    }
  },
  
  validation: {
    namePattern: /^[a-zA-Z0-9\-_\s]+$/,
    maxChildren: 0, // リーフノード
    customValidators: [
      {
        name: 'validCoordinates',
        validate: (entity: BaseMapEntity): ValidationResult => {
          const [lng, lat] = entity.center;
          const isValid = lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
          return isValid 
            ? { valid: true }
            : { valid: false, message: `Invalid coordinates: [${lng}, ${lat}]` };
        },
        getMessage: (entity: BaseMapEntity) => 
          `Coordinates [${entity.center[0]}, ${entity.center[1]}] are out of valid range`
      }
    ]
  }
};
```

### 10.1.14 BaseMapプラグイン

```typescript
// packages/plugins/basemap/src/index.ts

// MapRenderer の型定義
export interface MapRenderer {
  initialize(): Promise<void>;
  render(config: BaseMapEntity): Promise<{ url: string; thumbnail: string }>;
  cleanup(): Promise<void>;
}

// 型安全なプラグイン定義
export interface BaseMapPluginContext extends PluginContext {
  // BaseMap固有の拡張
  mapRenderer?: MapRenderer;
}

// BaseMapアイコンプロパティの型
export interface BaseMapIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const BaseMapPlugin: Plugin<BaseMapPluginContext> = {
  id: 'hierarchidb.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  description: 'Provides BaseMap node type for map visualization',
  
  nodeTypes: [BaseMapNodeDefinition],
  
  initialize: async (context: BaseMapPluginContext) => {
    console.log('BaseMap plugin initialized');
    
    // データベース初期化
    await BaseMapDB.getInstance().open();
    
    // UI コンポーネント登録（型安全）
    if (context.uiRegistry) {
      context.uiRegistry.registerComponent<BaseMapIconProps>(
        'basemap-icon',
        BaseMapIcon
      );
    }
    
    // マップレンダラーの初期化
    if (context.mapRenderer) {
      await context.mapRenderer.initialize();
    }
  },
  
  cleanup: async () => {
    console.log('BaseMap plugin cleanup');
    await BaseMapDB.getInstance().close();
  }
};
```
