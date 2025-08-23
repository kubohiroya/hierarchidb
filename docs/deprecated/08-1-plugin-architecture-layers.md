# プラグインアーキテクチャ：Worker層とUI層の分離設計

## 概要

HierarchiDBのプラグインシステムは、Worker層とUI層の2つの独立したプラグイン層で構成される。この分離により、データ処理とプレゼンテーションの関心事を明確に分離し、より柔軟で保守性の高いアーキテクチャを実現する。

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────┐
│                  Plugin Package                  │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │  Worker Plugin   │  │    UI Plugin     │    │
│  │                  │  │                  │    │
│  │ • Entity Handler │  │ • Dialogs        │    │
│  │ • Lifecycle      │  │ • Icons          │    │
│  │ • Validation     │  │ • Forms          │    │
│  │ • Business Logic │  │ • Panels         │    │
│  │ • Database       │  │ • Visualizations │    │
│  └──────────────────┘  └──────────────────┘    │
│           ↓                     ↓               │
└─────────────────────────────────────────────────┘
            ↓                     ↓
┌──────────────────┐    ┌──────────────────┐
│   Worker Layer   │    │     UI Layer     │
│                  │    │                  │
│ UnifiedNodeType  │    │  DialogRegistry  │
│    Registry      │←RPC→│  IconRegistry    │
│                  │    │  MenuRegistry    │
└──────────────────┘    └──────────────────┘
```

## Worker層プラグイン

### 責務
- データモデルの定義
- ビジネスロジックの実装
- データベース操作
- ライフサイクル管理
- バリデーション
- 権限管理

### 構成要素

#### 1. プラグイン定義（WorkerPluginDefinition）

```typescript
// packages/worker/src/plugins/types.ts
export interface WorkerPluginDefinition<
  TEntity extends BaseEntity,
  TSubEntity extends BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy
> {
  // 基本情報
  nodeType: TreeNodeType;
  name: string;
  version: string;
  
  // データベース設定
  database: {
    dbName: string;
    tableName: string;
    schema: string;
    version: number;
    migrations?: Migration[];
  };
  
  // エンティティハンドラー
  entityHandler: EntityHandler<TEntity, TSubEntity, TWorkingCopy>;
  
  // ライフサイクルフック
  lifecycle: {
    // 作成
    beforeCreate?: (parentId: TreeNodeId, data: Partial<TEntity>) => Promise<void>;
    afterCreate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;
    
    // 更新
    beforeUpdate?: (nodeId: TreeNodeId, changes: Partial<TEntity>) => Promise<void>;
    afterUpdate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;
    
    // 削除
    beforeDelete?: (nodeId: TreeNodeId) => Promise<void>;
    afterDelete?: (nodeId: TreeNodeId) => Promise<void>;
    
    // Working Copy
    beforeCommit?: (workingCopy: TWorkingCopy) => Promise<void>;
    afterCommit?: (entity: TEntity) => Promise<void>;
    
    // 移動
    beforeMove?: (nodeId: TreeNodeId, newParentId: TreeNodeId) => Promise<void>;
    afterMove?: (nodeId: TreeNodeId, newParentId: TreeNodeId) => Promise<void>;
  };
  
  // バリデーション
  validation: {
    // 名前パターン
    namePattern?: RegExp;
    
    // 階層制約
    maxDepth?: number;
    maxChildren?: number;
    
    // 親子関係
    allowedParentTypes?: TreeNodeType[];
    allowedChildTypes?: TreeNodeType[];
    
    // カスタムバリデーター
    validators?: Array<{
      name: string;
      validate: (entity: TEntity) => Promise<boolean | string>;
    }>;
  };
  
  // API拡張
  api?: {
    // Worker側で実行される拡張メソッド
    extensions: Record<string, (...args: any[]) => Promise<any>>;
  };
  
  // メタデータ
  metadata: {
    description?: string;
    author?: string;
    tags?: string[];
    dependencies?: TreeNodeType[];
  };
}
```

#### 2. EntityHandler実装例

```typescript
// packages/plugins/basemap/src/worker/BaseMapHandler.ts
export class BaseMapHandler implements EntityHandler<BaseMapEntity> {
  async create(parentId: TreeNodeId, data: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    // データベースにエンティティを作成
    const entity = {
      nodeId: generateId(),
      parentId,
      name: data.name || 'New Map',
      center: data.center || [0, 0],
      zoom: data.zoom || 10,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    await db.basemaps.add(entity);
    return entity;
  }
  
  async update(nodeId: TreeNodeId, changes: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    // エンティティを更新
    const existing = await db.basemaps.get(nodeId);
    const updated = {
      ...existing,
      ...changes,
      updatedAt: Date.now(),
      version: existing.version + 1
    };
    
    await db.basemaps.put(updated);
    return updated;
  }
  
  async delete(nodeId: TreeNodeId): Promise<void> {
    await db.basemaps.delete(nodeId);
  }
}
```

## UI層プラグイン

### 責務
- ユーザーインターフェースの提供
- アイコン・ビジュアル要素
- フォーム・ダイアログ
- データ表示・編集UI
- インタラクション処理
- プレゼンテーションロジック

### 構成要素

#### 1. プラグイン定義（UIPluginDefinition）

```typescript
// packages/ui-core/src/plugins/types.ts
export interface UIPluginDefinition {
  // 基本情報
  nodeType: TreeNodeType;
  displayName: string;
  
  // アイコン定義
  icon: {
    type: 'material' | 'custom' | 'svg';
    value: string | React.ComponentType;
    color?: string;
  };
  
  // UIコンポーネント
  components: {
    // 作成ダイアログ
    createDialog?: React.ComponentType<CreateDialogProps>;
    
    // 編集ダイアログ
    editDialog?: React.ComponentType<EditDialogProps>;
    
    // 詳細パネル
    detailPanel?: React.ComponentType<DetailPanelProps>;
    
    // インラインエディター
    inlineEditor?: React.ComponentType<InlineEditorProps>;
    
    // カスタムセルレンダラー
    cellRenderer?: React.ComponentType<CellRendererProps>;
    
    // プレビューコンポーネント
    preview?: React.ComponentType<PreviewProps>;
  };
  
  // メニュー設定
  menu: {
    // Createメニューでの表示順
    createOrder?: number;
    
    // メニューグループ
    group?: 'basic' | 'advanced' | 'custom';
    
    // コンテキストメニュー項目
    contextMenuItems?: ContextMenuItem[];
    
    // ツールバーアクション
    toolbarActions?: ToolbarAction[];
  };
  
  // UI動作設定
  behavior: {
    // ドラッグ&ドロップ可能か
    draggable?: boolean;
    
    // インライン編集可能か
    inlineEditable?: boolean;
    
    // 複数選択可能か
    multiSelectable?: boolean;
    
    // プレビュー可能か
    previewable?: boolean;
  };
  
  // スタイル設定
  style?: {
    // ノード行のカスタムスタイル
    rowStyle?: React.CSSProperties;
    
    // ホバー時のスタイル
    hoverStyle?: React.CSSProperties;
    
    // 選択時のスタイル
    selectedStyle?: React.CSSProperties;
  };
}
```

#### 2. UIコンポーネント実装例

```typescript
// packages/plugins/basemap/src/ui/BaseMapCreateDialog.tsx
export const BaseMapCreateDialog: React.FC<CreateDialogProps> = ({
  open,
  onClose,
  onSubmit,
  parentNodeId
}) => {
  const [formData, setFormData] = useState<BaseMapFormData>({
    name: '',
    description: '',
    center: [139.6917, 35.6895], // Tokyo
    zoom: 10,
    style: 'streets-v11'
  });
  
  const handleSubmit = async () => {
    // Worker層のAPIを呼び出してエンティティを作成
    const result = await workerAPI.createNode({
      parentId: parentNodeId,
      nodeType: 'basemap',
      data: formData
    });
    
    onSubmit(result);
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <MapIcon color="primary" />
          <Typography>Create Base Map</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <MapStyleSelector
              value={formData.style}
              onChange={(style) => setFormData({...formData, style})}
            />
          </Grid>
          
          <Grid item xs={6}>
            <CoordinatePicker
              label="Center"
              value={formData.center}
              onChange={(center) => setFormData({...formData, center})}
            />
          </Grid>
          
          <Grid item xs={6}>
            <Slider
              label="Initial Zoom"
              value={formData.zoom}
              min={0}
              max={22}
              onChange={(zoom) => setFormData({...formData, zoom})}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Create Map
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

## プラグインパッケージの構造

### 推奨ディレクトリ構造

```
packages/plugins/[plugin-name]/
├── package.json
├── README.md
├── src/
│   ├── openstreetmap-type.ts                 # エクスポート定義
│   │
│   ├── worker/                  # Worker層プラグイン
│   │   ├── openstreetmap-type.ts
│   │   ├── definition.ts        # WorkerPluginDefinition
│   │   ├── handler.ts           # EntityHandler実装
│   │   ├── lifecycle.ts         # ライフサイクルフック
│   │   ├── validation.ts        # バリデーションロジック
│   │   └── database.ts          # データベーススキーマ
│   │
│   ├── ui/                      # UI層プラグイン
│   │   ├── openstreetmap-type.ts
│   │   ├── definition.ts        # UIPluginDefinition
│   │   ├── dialogs/            # ダイアログコンポーネント
│   │   │   ├── CreateDialog.tsx
│   │   │   └── EditDialog.tsx
│   │   ├── panels/             # パネルコンポーネント
│   │   │   └── DetailPanel.tsx
│   │   ├── icons/              # アイコンコンポーネント
│   │   │   └── NodeIcon.tsx
│   │   └── styles/             # スタイル定義
│   │       └── theme.ts
│   │
│   ├── shared/                  # 共有型定義・ユーティリティ
│   │   ├── types.ts
│   │   └── constants.ts
│   │
│   └── tests/                   # テスト
│       ├── worker/
│       └── ui/
```

### package.json例

```json
{
  "name": "@hierarchidb/plugin-basemap",
  "version": "1.0.0",
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./worker": "./dist/worker/index.js",
    "./ui": "./dist/ui/index.js"
  },
  "peerDependencies": {
    "@hierarchidb/core": "*",
    "@hierarchidb/worker": "*",
    "@hierarchidb/ui-core": "*",
    "react": "^18.0.0"
  }
}
```

## プラグイン登録フロー

### 1. Worker層での登録

```typescript
// packages/worker/src/plugins/registry.ts
import { BaseMapWorkerPlugin } from '@hierarchidb/plugin-basemap/worker';

export class WorkerPluginRegistry {
  private plugins = new Map<TreeNodeType, WorkerPluginDefinition>();
  
  register(plugin: WorkerPluginDefinition) {
    // バリデーション
    this.validatePlugin(plugin);
    
    // 依存関係チェック
    this.checkDependencies(plugin);
    
    // 登録
    this.plugins.set(plugin.nodeType, plugin);
    
    // データベース初期化
    this.initializeDatabase(plugin);
    
    // ライフサイクルフック登録
    this.registerLifecycleHooks(plugin);
  }
}

// 起動時に登録
registry.register(BaseMapWorkerPlugin);
```

### 2. UI層での登録

```typescript
// packages/ui-core/src/plugins/registry.ts
import { BaseMapUIPlugin } from '@hierarchidb/plugin-basemap/ui';

export class UIPluginRegistry {
  private plugins = new Map<TreeNodeType, UIPluginDefinition>();
  
  register(plugin: UIPluginDefinition) {
    // 登録
    this.plugins.set(plugin.nodeType, plugin);
    
    // コンポーネント登録
    DialogRegistry.register(plugin.nodeType, plugin.components.createDialog);
    IconRegistry.register(plugin.nodeType, plugin.icon);
    MenuRegistry.register(plugin.nodeType, plugin.menu);
  }
}

// 起動時に登録
registry.register(BaseMapUIPlugin);
```

## Worker-UI層の通信

### メタデータ共有

```typescript
// Worker層からUI層へプラグイン情報を提供
export interface PluginMetadataAPI {
  // 登録されているノードタイプを取得
  getRegisteredNodeTypes(): Promise<Array<{
    nodeType: TreeNodeType;
    displayName: string;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>>;
  
  // 特定のノードタイプで作成可能な子ノードタイプを取得
  getAllowedChildTypes(parentType: TreeNodeType): Promise<TreeNodeType[]>;
  
  // ノードタイプの制約情報を取得
  getNodeTypeConstraints(nodeType: TreeNodeType): Promise<{
    maxChildren?: number;
    maxDepth?: number;
    namePattern?: string;
  }>;
}
```

### 動的メニュー生成

```typescript
// UI層でWorker層の情報を使用してメニューを生成
export const useDynamicCreateMenu = (parentNodeId: TreeNodeId) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  useEffect(() => {
    async function loadMenuItems() {
      // 親ノードのタイプを取得
      const parentNode = await workerAPI.getNode(parentNodeId);
      
      // 作成可能な子ノードタイプを取得
      const allowedTypes = await workerAPI.getAllowedChildTypes(parentNode.type);
      
      // UI層のプラグインレジストリから対応するUIを取得
      const items = allowedTypes.map(type => {
        const uiPlugin = UIPluginRegistry.get(type);
        return {
          nodeType: type,
          label: uiPlugin.displayName,
          icon: uiPlugin.icon,
          onClick: () => openCreateDialog(type)
        };
      });
      
      setMenuItems(items);
    }
    
    loadMenuItems();
  }, [parentNodeId]);
  
  return menuItems;
};
```

## 利点

### 関心事の分離
- **Worker層**: ビジネスロジックとデータ管理に集中
- **UI層**: ユーザー体験とプレゼンテーションに集中

### 独立した開発
- Worker層とUI層を別々のチームが開発可能
- モックを使用した独立したテストが可能

### 柔軟な組み合わせ
- 同じWorker層プラグインに複数のUI層プラグインを提供可能
- 異なるUIフレームワーク（React、Vue、Angular）への対応が容易

### パフォーマンス最適化
- Worker層: 重い処理をWorkerスレッドで実行
- UI層: 必要なコンポーネントのみを遅延ロード

## まとめ

プラグインシステムをWorker層とUI層に分離することで、より明確な責務分離と柔軟な拡張性を実現。各層は独立して開発・テスト・デプロイが可能であり、新しいノードタイプの追加が容易になる。