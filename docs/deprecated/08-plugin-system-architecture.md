# HierarchiDB プラグインシステム アーキテクチャ設計書

## 概要

HierarchiDBのプラグインシステムは、Worker層とUI層で異なるアプローチを採用することで、技術的合理性とUX一貫性を両立する。Worker層では既存の最適化されたアーキテクチャを維持し、UI側では全ノード種類を統一的なプラグインシステムで扱う。

## 設計原則

### 1. 層別最適化
- **Worker層**: 技術的最適化（既存アーキテクチャ維持）
- **UI層**: UX最適化（完全統一プラグインシステム）

### 2. 責務分離
- **Worker層**: データ整合性、ビジネスロジック、パフォーマンス
- **UI層**: ユーザー体験、表示制御、インタラクション

### 3. 段階的実装
- Worker側変更なし（移行リスクゼロ）
- UI側段階的プラグイン化

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Unified Plugin System                    │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │    │
│  │  │  Folder  │ │ BaseMap  │ │ Project  │   ...  │    │
│  │  │UI Plugin │ │UI Plugin │ │UI Plugin │        │    │
│  │  └──────────┘ └──────────┘ └──────────┘        │    │
│  └─────────────────────────────────────────────────┘    │
│                          ↕ RPC                           │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                   Worker Layer                           │
│  ┌─────────────────┐  ┌─────────────────────────────┐    │
│  │   TreeNode      │  │    Plugin System            │    │
│  │   Management    │  │  ┌──────────┐ ┌──────────┐  │    │
│  │   (既存維持)     │  │  │ BaseMap  │ │StyleMap  │  │    │
│  │                 │  │  │ Plugin   │ │ Plugin   │  │    │
│  └─────────────────┘  │  └──────────┘ └──────────┘  │    │
│                       └─────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Database Layer                      │    │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │    │
│  │ │  TreeNode   │ │   Entity    │ │ SubEntity   │ │    │
│  │ │   Tables    │ │   Tables    │ │   Tables    │ │    │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Worker層設計（現状維持）

### アーキテクチャ
Worker層は既存の最適化されたアーキテクチャを維持し、変更を行わない。

```typescript
// 既存のWorker層構造
interface TreeNode {
  treeNodeId: TreeNodeId;
  parentId: TreeNodeId;
  treeNodeType: TreeNodeType;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // ... その他の既存フィールド
}

// 既存のEntityシステム
interface BaseEntity {
  id: UUID;
  createdAt: number;
  updatedAt: number;
  version: number;
}

// 既存のプラグインシステム（エンティティ専用、変更なし）
interface UnifiedPluginDefinition<TEntity, TSubEntity, TWorkingCopy> {
  nodeType: TreeNodeType;
  entityHandler: EntityHandler<TEntity, TSubEntity, TWorkingCopy>;
  lifecycle: NodeLifecycleHooks<TEntity, TWorkingCopy>;
  // ... 既存の定義
}
```

### Worker層の責務
1. **TreeNode管理**: 階層構造、基本プロパティ
2. **Entity管理**: プラグイン固有データ
3. **ライフサイクル**: データ操作時のフック実行
4. **データ整合性**: トランザクション、バリデーション
5. **パフォーマンス**: 最適化されたデータアクセス

### 既存APIの維持
```typescript
// 既存のWorkerAPI（変更なし）
export interface WorkerAPI {
  // TreeNode操作
  getTreeNode(nodeId: TreeNodeId): Promise<TreeNode>;
  createTreeNode(data: TreeNodeData): Promise<TreeNodeId>;
  updateTreeNode(nodeId: TreeNodeId, changes: Partial<TreeNode>): Promise<void>;
  deleteTreeNode(nodeId: TreeNodeId): Promise<void>;
  
  // Entity操作（プラグイン経由）
  getEntity(nodeId: TreeNodeId, entityType: string): Promise<any>;
  createNodeWithEntity(data: CreateNodeWithEntityParams): Promise<TreeNodeId>;
  updateEntity(nodeId: TreeNodeId, entityType: string, changes: any): Promise<void>;
  
  // 階層操作
  getChildren(nodeId: TreeNodeId): Promise<TreeNode[]>;
  moveNode(nodeId: TreeNodeId, newParentId: TreeNodeId): Promise<void>;
  
  // ... その他既存API
}
```

## UI層設計（新規統一システム）

### 統一プラグインシステム

すべてのノード種類（フォルダ、エンティティ付きノード）を統一的に扱うプラグインシステム。

#### UIPluginDefinition

Folderプラグインの実装に基づいて標準化されたインターフェース：

```typescript
// packages/ui-core/src/plugins/types.ts
export interface UIPluginDefinition {
  // 基本情報
  readonly nodeType: string;
  readonly displayName: string;
  readonly description?: string;
  
  // データソース定義
  readonly dataSource: {
    // TreeNodeのみ（フォルダ等）か、Entity必要（BaseMap等）か
    readonly requiresEntity: boolean;
    // Entity必要な場合のタイプ
    readonly entityType?: string;
  };
  
  // 機能定義
  readonly capabilities: {
    readonly canCreate: boolean;
    readonly canRead: boolean;
    readonly canUpdate: boolean;
    readonly canDelete: boolean;
    readonly canHaveChildren: boolean;
    readonly canMove: boolean;
    readonly supportsWorkingCopy: boolean;
    readonly supportsVersioning: boolean;
    readonly supportsExport: boolean;
    readonly supportsBulkOperations: boolean;
  };
  
  // UIコンポーネント
  readonly components: {
    readonly icon: React.ComponentType<any>;
    readonly createDialog?: React.ComponentType<any>;
    readonly editDialog?: React.ComponentType<any>;
    readonly detailPanel?: React.ComponentType<any>;
    readonly tableCell?: React.ComponentType<any>;
    readonly preview?: React.ComponentType<any>;
  };
  
  // アクションフック（UI層CRUD拡張）
  readonly hooks: UIActionHooks;
  
  // メニュー・表示設定
  readonly menu: {
    readonly createOrder: number;
    readonly group: 'basic' | 'container' | 'document' | 'advanced';
    readonly contextMenuItems?: readonly ContextMenuItem[];
  };
  
  // スタイル設定
  readonly style?: {
    readonly primaryColor?: string;
    readonly icon?: string;
    readonly rowStyle?: React.CSSProperties;
  };
}
```

#### UIActionHooks（UI層のCRUDフック）

```typescript
export interface UIActionHooks {
  // Create アクション
  beforeShowCreateDialog?: (params: {
    parentNodeId: TreeNodeId;
    nodeType: TreeNodeType;
    context: UIContext;
  }) => Promise<{
    proceed: boolean;
    modifiedParams?: any;
    message?: string;
  }>;
  
  onShowCreateDialog?: (params: {
    parentNodeId: TreeNodeId;
    nodeType: TreeNodeType;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
  }) => Promise<void>;
  
  onValidateCreateForm?: (params: {
    formData: any;
    parentNodeId: TreeNodeId;
  }) => Promise<{
    valid: boolean;
    errors?: Record<string, string>;
    warnings?: string[];
  }>;
  
  afterCreate?: (params: {
    nodeId: TreeNodeId;
    data: any;
    parentNodeId: TreeNodeId;
  }) => Promise<{
    navigateTo?: TreeNodeId;
    showMessage?: string;
    refreshNodes?: TreeNodeId[];
  }>;
  
  // Read アクション
  onFormatDisplay?: (params: {
    data: any;
    field: string;
    viewType: 'table' | 'detail' | 'preview';
  }) => Promise<string | React.ReactNode>;
  
  onGeneratePreview?: (params: {
    nodeId: TreeNodeId;
    data: any;
  }) => Promise<React.ComponentType<PreviewProps>>;
  
  // Update アクション
  beforeStartEdit?: (params: {
    nodeId: TreeNodeId;
    currentData: any;
    editMode: 'inline' | 'dialog' | 'panel';
  }) => Promise<{
    proceed: boolean;
    readOnlyFields?: string[];
    editableFields?: string[];
  }>;
  
  onShowEditDialog?: (params: {
    nodeId: TreeNodeId;
    currentData: any;
    onSubmit: (changes: any) => Promise<void>;
    onCancel: () => void;
  }) => Promise<void>;
  
  afterUpdate?: (params: {
    nodeId: TreeNodeId;
    changes: any;
    updatedData: any;
  }) => Promise<{
    refreshNodes?: TreeNodeId[];
    showMessage?: string;
  }>;
  
  // Delete アクション
  beforeDelete?: (params: {
    nodeIds: TreeNodeId[];
    entities: any[];
    hasChildren: boolean;
  }) => Promise<{
    proceed: boolean;
    confirmMessage?: string;
    showChildrenWarning?: boolean;
  }>;
  
  afterDelete?: (params: {
    deletedNodeIds: TreeNodeId[];
    parentIds: TreeNodeId[];
  }) => Promise<{
    navigateTo?: TreeNodeId;
    showMessage?: string;
    refreshNodes?: TreeNodeId[];
  }>;
  
  // その他アクション
  onContextMenu?: (params: {
    nodeId: TreeNodeId;
    data: any;
    mousePosition: { x: number; y: number };
  }) => Promise<ContextMenuItem[]>;
  
  onExport?: (params: {
    nodeIds: TreeNodeId[];
    format: string;
  }) => Promise<Blob>;
  
  onDragStart?: (params: {
    nodeId: TreeNodeId;
    data: any;
  }) => Promise<{
    proceed: boolean;
    dragImage?: HTMLElement;
  }>;
  
  onDrop?: (params: {
    draggedNodeId: TreeNodeId;
    targetNodeId: TreeNodeId;
    position: 'before' | 'after' | 'inside';
  }) => Promise<{
    proceed: boolean;
    confirmMessage?: string;
  }>;
}
```

### データアダプター（Worker-UI橋渡し）

```typescript
// packages/ui-core/src/plugins/adapters/NodeDataAdapter.ts
export class NodeDataAdapter {
  constructor(private workerAPI: WorkerAPI) {}
  
  /**
   * 統一されたノードデータ取得
   * プラグインの設定に応じてTreeNode + Entity情報を統合
   */
  async getNodeData(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<UnifiedNodeData> {
    const plugin = UIPluginRegistry.get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown plugin type: ${nodeType}`);
    }
    
    // 1. TreeNodeデータを取得（全ノード共通）
    const treeNode = await this.workerAPI.getTreeNode(nodeId);
    
    if (!plugin.dataSource.requiresEntity) {
      // フォルダなど：TreeNodeのみ使用
      return {
        treeNode,
        entity: null,
        combinedData: {
          id: treeNode.treeNodeId,
          name: treeNode.name,
          type: treeNode.treeNodeType,
          parentId: treeNode.parentId,
          description: treeNode.description,
          createdAt: treeNode.createdAt,
          updatedAt: treeNode.updatedAt,
          // フォルダ固有の表示情報
          hasChildren: await this.hasChildren(nodeId),
          childCount: await this.getChildCount(nodeId)
        }
      };
    } else {
      // BaseMapなど：TreeNode + Entity使用
      const entity = await this.workerAPI.getEntity(nodeId, plugin.dataSource.entityType!);
      return {
        treeNode,
        entity,
        combinedData: {
          // TreeNode基本情報
          id: treeNode.treeNodeId,
          name: treeNode.name,
          type: treeNode.treeNodeType,
          parentId: treeNode.parentId,
          description: treeNode.description,
          
          // Entity詳細情報を展開
          ...entity,
          
          // 統合されたタイムスタンプ
          createdAt: treeNode.createdAt,
          updatedAt: Math.max(treeNode.updatedAt, entity?.updatedAt || 0),
          
          // メタデータ
          version: entity?.version || 1,
          size: this.calculateSize(entity)
        }
      };
    }
  }
  
  /**
   * 統一されたノード作成
   */
  async createNode(
    parentId: TreeNodeId, 
    nodeType: TreeNodeType, 
    data: any
  ): Promise<TreeNodeId> {
    const plugin = UIPluginRegistry.get(nodeType);
    
    if (!plugin.dataSource.requiresEntity) {
      // フォルダ作成：TreeNodeのみ
      return await this.workerAPI.createTreeNode({
        parentId,
        treeNodeType: nodeType,
        name: data.name,
        description: data.description || ''
      });
    } else {
      // エンティティ付きノード作成：TreeNode + Entity
      return await this.workerAPI.createNodeWithEntity({
        parentId,
        treeNodeType: nodeType,
        treeNodeData: {
          name: data.name,
          description: data.description || ''
        },
        entityType: plugin.dataSource.entityType!,
        entityData: data
      });
    }
  }
  
  /**
   * 統一されたノード更新
   */
  async updateNode(
    nodeId: TreeNodeId,
    nodeType: TreeNodeType,
    changes: any
  ): Promise<void> {
    const plugin = UIPluginRegistry.get(nodeType);
    
    // TreeNode更新（名前、説明など基本情報）
    const treeNodeChanges: Partial<TreeNode> = {};
    if (changes.name !== undefined) treeNodeChanges.name = changes.name;
    if (changes.description !== undefined) treeNodeChanges.description = changes.description;
    
    if (Object.keys(treeNodeChanges).length > 0) {
      await this.workerAPI.updateTreeNode(nodeId, treeNodeChanges);
    }
    
    // Entity更新（プラグイン固有データ）
    if (plugin.dataSource.requiresEntity && this.hasEntityChanges(changes)) {
      const entityChanges = this.extractEntityChanges(changes);
      await this.workerAPI.updateEntity(
        nodeId, 
        plugin.dataSource.entityType!, 
        entityChanges
      );
    }
  }
  
  /**
   * 統一されたノード削除
   */
  async deleteNode(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<void> {
    // TreeNodeの削除により、関連Entityも自動削除される（既存のWorker層仕組み）
    await this.workerAPI.deleteTreeNode(nodeId);
  }
  
  private hasEntityChanges(changes: any): boolean {
    const treeNodeFields = new Set(['name', 'description']);
    return Object.keys(changes).some(key => !treeNodeFields.has(key));
  }
  
  private extractEntityChanges(changes: any): any {
    const treeNodeFields = new Set(['name', 'description']);
    const entityChanges: any = {};
    
    for (const [key, value] of Object.entries(changes)) {
      if (!treeNodeFields.has(key)) {
        entityChanges[key] = value;
      }
    }
    
    return entityChanges;
  }
}

export interface UnifiedNodeData {
  treeNode: TreeNode;
  entity: any | null;
  combinedData: any; // UIで使用する統合データ
}
```

## 具体的なプラグイン実装例

### 1. Folder UIPlugin（基本型）

```typescript
// packages/ui-core/src/plugins/basic/FolderUIPlugin.tsx
export const FolderUIPlugin: UIPluginDefinition = {
  nodeType: 'folder',
  displayName: 'Folder',
  description: 'Organize files and other items',
  
  dataSource: {
    requiresEntity: false // TreeNodeのみ使用
  },
  
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: true,
    canMove: true,
    supportsWorkingCopy: false,
    supportsVersioning: false,
    supportsExport: false,
    supportsBulkOperations: true
  },
  
  components: {
    icon: FolderIcon,
    createDialog: FolderCreateDialog,
    editDialog: FolderEditDialog,
    tableCell: FolderTableCell
  },
  
  hooks: {
    beforeShowCreateDialog: async ({ parentNodeId }) => {
      // 権限チェック
      const canCreate = await checkCreatePermission(parentNodeId);
      return {
        proceed: canCreate,
        message: canCreate ? undefined : 'No permission to create folders here'
      };
    },
    
    onShowCreateDialog: async ({ parentNodeId, onSubmit, onCancel }) => {
      const dialog = (
        <FolderCreateDialog
          parentNodeId={parentNodeId}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );
      showDialog(dialog);
    },
    
    onValidateCreateForm: async ({ formData, parentNodeId }) => {
      const errors: Record<string, string> = {};
      
      // 名前の必須チェック
      if (!formData.name?.trim()) {
        errors.name = 'Folder name is required';
      }
      
      // 重複チェック
      const siblings = await nodeAdapter.getChildren(parentNodeId);
      if (siblings.some(s => s.name === formData.name && s.type === 'folder')) {
        errors.name = 'Folder name already exists';
      }
      
      // 名前形式チェック
      if (formData.name && !/^[^<>:"/\\|?*]+$/.test(formData.name)) {
        errors.name = 'Invalid characters in folder name';
      }
      
      return {
        valid: Object.keys(errors).length === 0,
        errors
      };
    },
    
    afterCreate: async ({ nodeId, data }) => {
      return {
        showMessage: `Folder "${data.name}" created successfully`,
        navigateTo: nodeId
      };
    },
    
    beforeDelete: async ({ nodeIds, entities }) => {
      // 子を持つフォルダの確認
      const foldersWithChildren = await Promise.all(
        nodeIds.map(async (id) => {
          const hasChildren = await nodeAdapter.hasChildren(id);
          return hasChildren ? id : null;
        })
      );
      
      const nonEmptyFolders = foldersWithChildren.filter(Boolean);
      
      if (nonEmptyFolders.length > 0) {
        return {
          proceed: true,
          confirmMessage: `${nonEmptyFolders.length} folder(s) contain items. Delete all contents?`,
          showChildrenWarning: true
        };
      }
      
      return { proceed: true };
    },
    
    onContextMenu: async ({ nodeId, data }) => {
      return [
        {
          label: 'New Folder',
          icon: 'create_new_folder',
          action: () => createSubfolder(nodeId)
        },
        {
          label: 'Properties',
          icon: 'info',
          action: () => showFolderProperties(nodeId)
        },
        {
          label: 'Copy Path',
          icon: 'content_copy',
          action: () => copyFolderPath(nodeId)
        }
      ];
    }
  },
  
  menu: {
    createOrder: 1,
    group: 'basic'
  },
  
  style: {
    primaryColor: '#FFA726',
    icon: 'folder'
  }
};

// フォルダ作成ダイアログ
const FolderCreateDialog: React.FC<CreateDialogProps> = ({ 
  parentNodeId, 
  onSubmit, 
  onCancel 
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleSubmit = async () => {
    const validation = await FolderUIPlugin.hooks.onValidateCreateForm?.({
      formData: { name, description },
      parentNodeId
    });
    
    if (!validation?.valid) {
      setErrors(validation?.errors || {});
      return;
    }
    
    await onSubmit({ name, description });
  };
  
  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <FolderIcon color="primary" />
          <Typography>Create New Folder</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              autoFocus
              fullWidth
              label="Folder Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button 
          onClick={handleSubmit}
          variant="contained" 
          disabled={!name.trim()}
        >
          Create Folder
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### 2. BaseMap UIPlugin（エンティティ型）

```typescript
// packages/plugins/basemap/src/ui/BaseMapUIPlugin.tsx
export const BaseMapUIPlugin: UIPluginDefinition = {
  nodeType: 'basemap',
  displayName: 'Base Map',
  description: 'Geographic base map with styling',
  
  dataSource: {
    requiresEntity: true,
    entityType: 'BaseMapEntity'
  },
  
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: false,
    canMove: true,
    supportsWorkingCopy: true,
    supportsVersioning: true,
    supportsExport: true,
    supportsBulkOperations: false
  },
  
  components: {
    icon: MapIcon,
    createDialog: BaseMapCreateDialog,
    editDialog: BaseMapEditDialog,
    detailPanel: BaseMapDetailPanel,
    preview: MapPreviewComponent,
    tableCell: MapTableCell
  },
  
  hooks: {
    beforeShowCreateDialog: async ({ parentNodeId, context }) => {
      // 位置情報権限チェック
      try {
        const hasPermission = await checkGeolocationPermission();
        if (!hasPermission) {
          return {
            proceed: false,
            message: 'Geolocation permission is required to create maps'
          };
        }
      } catch (error) {
        // 権限チェック失敗は警告のみ
        console.warn('Could not check geolocation permission:', error);
      }
      
      return { proceed: true };
    },
    
    onShowCreateDialog: async ({ parentNodeId, onSubmit, onCancel }) => {
      const dialog = (
        <BaseMapCreateDialog
          parentNodeId={parentNodeId}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );
      showDialog(dialog);
    },
    
    onValidateCreateForm: async ({ formData }) => {
      const errors: Record<string, string> = {};
      const warnings: string[] = [];
      
      // 名前の必須チェック
      if (!formData.name?.trim()) {
        errors.name = 'Map name is required';
      }
      
      // 座標の検証
      if (formData.center && Array.isArray(formData.center)) {
        const [lng, lat] = formData.center;
        if (lng < -180 || lng > 180) {
          errors.coordinates = 'Longitude must be between -180 and 180';
        }
        if (lat < -90 || lat > 90) {
          errors.coordinates = 'Latitude must be between -90 and 90';
        }
      }
      
      // ズームレベルの検証
      if (formData.zoom !== undefined) {
        if (formData.zoom < 0 || formData.zoom > 22) {
          errors.zoom = 'Zoom level must be between 0 and 22';
        }
        if (formData.zoom > 18) {
          warnings.push('High zoom levels may have limited tile availability');
        }
      }
      
      return {
        valid: Object.keys(errors).length === 0,
        errors,
        warnings
      };
    },
    
    afterCreate: async ({ nodeId, data }) => {
      return {
        showMessage: `Map "${data.name}" created successfully`,
        navigateTo: nodeId
      };
    },
    
    onFormatDisplay: async ({ data, field, viewType }) => {
      switch (field) {
        case 'coordinates':
          if (data.center && Array.isArray(data.center)) {
            const [lng, lat] = data.center;
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          }
          return 'Unknown';
          
        case 'zoom':
          return `Level ${data.zoom || 0}`;
          
        case 'style':
          return data.style?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Default';
          
        case 'size':
          if (data.bounds) {
            const [minLng, minLat, maxLng, maxLat] = data.bounds;
            const width = maxLng - minLng;
            const height = maxLat - minLat;
            return `${width.toFixed(3)}° × ${height.toFixed(3)}°`;
          }
          return 'Not calculated';
          
        default:
          return null;
      }
    },
    
    onGeneratePreview: async ({ nodeId, data }) => {
      return () => (
        <MapPreviewComponent
          center={data.center}
          zoom={data.zoom}
          style={data.style}
          readonly
        />
      );
    },
    
    onExport: async ({ nodeIds, format }) => {
      const maps = await Promise.all(
        nodeIds.map(id => nodeAdapter.getNodeData(id, 'basemap'))
      );
      
      switch (format) {
        case 'geojson':
          const features = maps.map(mapData => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: mapData.combinedData.center
            },
            properties: {
              name: mapData.combinedData.name,
              zoom: mapData.combinedData.zoom,
              style: mapData.combinedData.style
            }
          }));
          
          const geoJson = {
            type: 'FeatureCollection',
            features
          };
          
          return new Blob([JSON.stringify(geoJson, null, 2)], { 
            type: 'application/geo+json' 
          });
          
        case 'kml':
          const kmlContent = generateKMLFromMaps(maps);
          return new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    },
    
    onContextMenu: async ({ nodeId, data }) => {
      return [
        {
          label: 'Open in Map Editor',
          icon: 'edit_location',
          action: () => openMapEditor(nodeId)
        },
        {
          label: 'Duplicate Map',
          icon: 'content_copy',
          action: () => duplicateMap(nodeId)
        },
        {
          label: 'Export as GeoJSON',
          icon: 'download',
          action: () => exportMapAsGeoJSON(nodeId)
        },
        {
          label: 'Share Map',
          icon: 'share',
          action: () => shareMap(nodeId)
        },
        {
          label: 'View on External Map',
          icon: 'open_in_new',
          action: () => openInExternalMap(data.center, data.zoom)
        }
      ];
    }
  },
  
  menu: {
    createOrder: 10,
    group: 'document'
  },
  
  style: {
    primaryColor: '#4CAF50',
    icon: 'map'
  }
};
```

### 3. Project UIPlugin（コンテナ型）

```typescript
// packages/plugins/core-project/src/ui/ProjectUIPlugin.tsx
export const ProjectUIPlugin: UIPluginDefinition = {
  nodeType: 'project',
  displayName: 'Project',
  description: 'Container for organizing maps and related resources',
  
  dataSource: {
    requiresEntity: true,
    entityType: 'ProjectEntity'
  },
  
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: true,
    canMove: true,
    supportsWorkingCopy: false,
    supportsVersioning: false,
    supportsExport: true,
    supportsBulkOperations: true
  },
  
  components: {
    icon: ProjectIcon,
    createDialog: ProjectCreateDialog,
    editDialog: ProjectEditDialog,
    detailPanel: ProjectDetailPanel
  },
  
  hooks: {
    onShowCreateDialog: async ({ parentNodeId, onSubmit, onCancel }) => {
      const dialog = (
        <ProjectCreateDialog
          parentNodeId={parentNodeId}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );
      showDialog(dialog);
    },
    
    onValidateCreateForm: async ({ formData }) => {
      const errors: Record<string, string> = {};
      
      if (!formData.name?.trim()) {
        errors.name = 'Project name is required';
      }
      
      if (formData.settings?.maxChildren && formData.settings.maxChildren < 1) {
        errors.maxChildren = 'Maximum children must be at least 1';
      }
      
      return {
        valid: Object.keys(errors).length === 0,
        errors
      };
    },
    
    afterCreate: async ({ nodeId, data }) => {
      // プロジェクト作成後、デフォルトフォルダを作成
      await nodeAdapter.createNode(nodeId, 'folder', { name: 'Maps' });
      await nodeAdapter.createNode(nodeId, 'folder', { name: 'Documentation' });
      
      return {
        showMessage: `Project "${data.name}" created with default folders`,
        navigateTo: nodeId
      };
    },
    
    onFormatDisplay: async ({ data, field }) => {
      switch (field) {
        case 'childCount':
          const count = await nodeAdapter.getChildCount(data.id);
          return `${count} items`;
          
        case 'permissions':
          const perms = data.permissions || {};
          const memberCount = (perms.readers?.length || 0) + 
                             (perms.writers?.length || 0) + 
                             (perms.admins?.length || 0) + 1; // +1 for owner
          return `${memberCount} members`;
          
        case 'lastActivity':
          if (data.lastActivity) {
            return formatRelativeTime(data.lastActivity);
          }
          return 'No recent activity';
          
        default:
          return null;
      }
    },
    
    onExport: async ({ nodeIds, format }) => {
      if (format === 'zip') {
        // プロジェクト全体をZIPで出力
        return await exportProjectsAsZip(nodeIds);
      } else if (format === 'json') {
        // プロジェクト構造をJSONで出力
        return await exportProjectsAsJSON(nodeIds);
      }
      
      throw new Error(`Unsupported export format: ${format}`);
    },
    
    onContextMenu: async ({ nodeId, data }) => {
      return [
        {
          label: 'Project Settings',
          icon: 'settings',
          action: () => openProjectSettings(nodeId)
        },
        {
          label: 'Manage Members',
          icon: 'group',
          action: () => openMemberManagement(nodeId)
        },
        {
          label: 'Export Project',
          icon: 'archive',
          action: () => exportProject(nodeId)
        },
        {
          label: 'Duplicate Project',
          icon: 'content_copy',
          action: () => duplicateProject(nodeId)
        }
      ];
    }
  },
  
  menu: {
    createOrder: 5,
    group: 'container'
  },
  
  style: {
    primaryColor: '#2196F3',
    icon: 'folder_special'
  }
};
```

## 統一CRUD操作システム

### UnifiedNodeOperations

```typescript
// packages/ui-core/src/plugins/operations/UnifiedNodeOperations.ts
export class UnifiedNodeOperations {
  constructor(
    private nodeAdapter: NodeDataAdapter,
    private notificationService: NotificationService
  ) {}
  
  /**
   * 統一された作成処理
   * 全ノードタイプで同じインターフェース
   */
  async createNode(parentId: TreeNodeId, nodeType: TreeNodeType): Promise<void> {
    const plugin = UIPluginRegistry.get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }
    
    try {
      // 1. 作成前チェック
      const beforeResult = await plugin.hooks.beforeShowCreateDialog?.({
        parentNodeId: parentId,
        nodeType,
        context: this.getCurrentContext()
      });
      
      if (!beforeResult?.proceed) {
        if (beforeResult?.message) {
          this.notificationService.showWarning(beforeResult.message);
        }
        return;
      }
      
      // 2. カスタムダイアログまたはデフォルトダイアログを表示
      if (plugin.hooks.onShowCreateDialog) {
        await plugin.hooks.onShowCreateDialog({
          parentNodeId: parentId,
          nodeType,
          onSubmit: async (data) => {
            await this.executeCreate(parentId, nodeType, data, plugin);
          },
          onCancel: () => {
            // キャンセル処理
          }
        });
      } else {
        // デフォルトの作成処理
        await this.showDefaultCreateDialog(parentId, nodeType, plugin);
      }
      
    } catch (error) {
      console.error('Error creating node:', error);
      this.notificationService.showError(`Failed to create ${plugin.displayName}`);
    }
  }
  
  private async executeCreate(
    parentId: TreeNodeId, 
    nodeType: TreeNodeType, 
    data: any,
    plugin: UIPluginDefinition
  ): Promise<void> {
    // バリデーション
    if (plugin.hooks.onValidateCreateForm) {
      const validation = await plugin.hooks.onValidateCreateForm({
        formData: data,
        parentNodeId: parentId
      });
      
      if (!validation.valid) {
        const errorMessage = Object.values(validation.errors || {}).join(', ');
        this.notificationService.showError(`Validation failed: ${errorMessage}`);
        return;
      }
      
      if (validation.warnings?.length) {
        for (const warning of validation.warnings) {
          this.notificationService.showWarning(warning);
        }
      }
    }
    
    // 実際の作成処理
    const nodeId = await this.nodeAdapter.createNode(parentId, nodeType, data);
    
    // 作成後処理
    if (plugin.hooks.afterCreate) {
      const afterResult = await plugin.hooks.afterCreate({
        nodeId,
        data,
        parentNodeId: parentId
      });
      
      if (afterResult.showMessage) {
        this.notificationService.showSuccess(afterResult.showMessage);
      }
      
      if (afterResult.navigateTo) {
        this.navigationService.navigateTo(afterResult.navigateTo);
      }
      
      if (afterResult.refreshNodes) {
        this.dataRefreshService.refresh(afterResult.refreshNodes);
      }
    } else {
      // デフォルトの成功メッセージ
      this.notificationService.showSuccess(`${plugin.displayName} created successfully`);
    }
  }
  
  /**
   * 統一された編集処理
   */
  async editNode(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<void> {
    const plugin = UIPluginRegistry.get(nodeType);
    if (!plugin) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }
    
    try {
      // 現在のデータを取得
      const nodeData = await this.nodeAdapter.getNodeData(nodeId, nodeType);
      
      // 編集前チェック
      const beforeResult = await plugin.hooks.beforeStartEdit?.({
        nodeId,
        currentData: nodeData.combinedData,
        editMode: 'dialog'
      });
      
      if (!beforeResult?.proceed) {
        if (beforeResult?.message) {
          this.notificationService.showWarning(beforeResult.message);
        }
        return;
      }
      
      // カスタム編集ダイアログまたはデフォルト
      if (plugin.hooks.onShowEditDialog) {
        await plugin.hooks.onShowEditDialog({
          nodeId,
          currentData: nodeData.combinedData,
          onSubmit: async (changes) => {
            await this.executeUpdate(nodeId, nodeType, changes, plugin);
          },
          onCancel: () => {
            // キャンセル処理
          }
        });
      } else {
        await this.showDefaultEditDialog(nodeId, nodeType, nodeData.combinedData, plugin);
      }
      
    } catch (error) {
      console.error('Error editing node:', error);
      this.notificationService.showError(`Failed to edit ${plugin.displayName}`);
    }
  }
  
  /**
   * 統一された削除処理
   */
  async deleteNodes(nodeIds: TreeNodeId[]): Promise<void> {
    if (nodeIds.length === 0) return;
    
    try {
      // ノードタイプごとにグループ化
      const nodesByType = await this.groupNodesByType(nodeIds);
      
      let totalConfirmMessage = '';
      let requiresConfirmation = false;
      
      // 各タイプの削除前チェック
      for (const [nodeType, nodes] of nodesByType) {
        const plugin = UIPluginRegistry.get(nodeType);
        if (!plugin) continue;
        
        const beforeResult = await plugin.hooks.beforeDelete?.({
          nodeIds: nodes.map(n => n.id),
          entities: nodes,
          hasChildren: await this.checkAnyHasChildren(nodes.map(n => n.id))
        });
        
        if (!beforeResult?.proceed) {
          this.notificationService.showWarning(
            `Cannot delete ${plugin.displayName}(s): ${beforeResult?.message || 'Operation not allowed'}`
          );
          return;
        }
        
        if (beforeResult?.confirmMessage) {
          totalConfirmMessage += beforeResult.confirmMessage + '\n';
          requiresConfirmation = true;
        }
      }
      
      // 確認ダイアログ
      if (requiresConfirmation) {
        const confirmed = await this.showConfirmDialog(
          totalConfirmMessage.trim() || `Delete ${nodeIds.length} item(s)?`
        );
        if (!confirmed) return;
      }
      
      // 実際の削除処理
      for (const [nodeType, nodes] of nodesByType) {
        const plugin = UIPluginRegistry.get(nodeType);
        if (!plugin) continue;
        
        await Promise.all(
          nodes.map(node => this.nodeAdapter.deleteNode(node.id, nodeType))
        );
        
        // 削除後処理
        await plugin.hooks.afterDelete?.({
          deletedNodeIds: nodes.map(n => n.id),
          parentIds: Array.from(new Set(nodes.map(n => n.parentId)))
        });
      }
      
      this.notificationService.showSuccess(`${nodeIds.length} item(s) deleted successfully`);
      
    } catch (error) {
      console.error('Error deleting nodes:', error);
      this.notificationService.showError('Failed to delete items');
    }
  }
  
  private async groupNodesByType(nodeIds: TreeNodeId[]): Promise<Map<TreeNodeType, any[]>> {
    const nodesByType = new Map<TreeNodeType, any[]>();
    
    for (const nodeId of nodeIds) {
      const treeNode = await this.nodeAdapter.workerAPI.getTreeNode(nodeId);
      const nodeType = treeNode.treeNodeType;
      
      if (!nodesByType.has(nodeType)) {
        nodesByType.set(nodeType, []);
      }
      
      nodesByType.get(nodeType)!.push({
        id: nodeId,
        ...treeNode
      });
    }
    
    return nodesByType;
  }
}
```

## プラグインレジストリとブートストラップ

### UIPluginRegistry

```typescript
// packages/ui-core/src/plugins/registry/UIPluginRegistry.ts
export class UIPluginRegistry {
  private static instance: UIPluginRegistry;
  private plugins = new Map<TreeNodeType, UIPluginDefinition>();
  
  static getInstance(): UIPluginRegistry {
    if (!UIPluginRegistry.instance) {
      UIPluginRegistry.instance = new UIPluginRegistry();
    }
    return UIPluginRegistry.instance;
  }
  
  register(plugin: UIPluginDefinition): void {
    // バリデーション
    this.validatePlugin(plugin);
    
    // 登録
    this.plugins.set(plugin.nodeType, plugin);
    
    console.log(`UI Plugin registered: ${plugin.nodeType} (${plugin.displayName})`);
  }
  
  get(nodeType: TreeNodeType): UIPluginDefinition | undefined {
    return this.plugins.get(nodeType);
  }
  
  getAll(): UIPluginDefinition[] {
    return Array.from(this.plugins.values());
  }
  
  getByGroup(group: string): UIPluginDefinition[] {
    return this.getAll().filter(plugin => plugin.menu.group === group);
  }
  
  private validatePlugin(plugin: UIPluginDefinition): void {
    if (!plugin.nodeType) {
      throw new Error('Plugin must have a nodeType');
    }
    
    if (!plugin.displayName) {
      throw new Error('Plugin must have a displayName');
    }
    
    if (!plugin.components?.icon) {
      throw new Error('Plugin must have an icon component');
    }
    
    if (this.plugins.has(plugin.nodeType)) {
      throw new Error(`Plugin with nodeType '${plugin.nodeType}' already registered`);
    }
  }
}

// 全プラグインの登録
export function registerAllUIPlugins(): void {
  const registry = UIPluginRegistry.getInstance();
  
  // 基本プラグイン
  registry.register(FolderUIPlugin);
  
  // ドキュメントプラグイン
  registry.register(BaseMapUIPlugin);
  registry.register(StyleMapUIPlugin);
  registry.register(RoutesUIPlugin);
  
  // コンテナプラグイン
  registry.register(ProjectUIPlugin);
  
  // 追加プラグイン（必要に応じて）
  // registry.register(CustomUIPlugin);
}
```

### アプリケーション初期化

```typescript
// packages/_app/src/main.tsx
import { registerAllUIPlugins } from '@hierarchidb/ui-core/plugins';

async function initializeApp() {
  // UI プラグインの登録
  registerAllUIPlugins();
  
  // その他の初期化処理
  await initializeWorkerConnection();
  await loadUserSettings();
  
  // アプリケーション開始
  ReactDOM.render(<App />, document.getElementById('root'));
}

initializeApp();
```

## 動的メニュー生成システム

### useDynamicCreateMenu

```typescript
// packages/ui-treeconsole/src/hooks/useDynamicCreateMenu.ts
export const useDynamicCreateMenu = (parentNodeId: TreeNodeId) => {
  const [menuItems, setMenuItems] = useState<CreateMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadMenuItems() {
      try {
        setLoading(true);
        
        // 親ノードの情報を取得
        const parentNode = await nodeAdapter.workerAPI.getTreeNode(parentNodeId);
        const parentPlugin = UIPluginRegistry.getInstance().get(parentNode.treeNodeType);
        
        // 親ノードが子を持てない場合は空メニュー
        if (!parentPlugin?.capabilities.canHaveChildren) {
          setMenuItems([]);
          return;
        }
        
        // 利用可能な全プラグインを取得
        const allPlugins = UIPluginRegistry.getInstance().getAll();
        
        // 作成可能なプラグインをフィルタリング
        const creatablePlugins = allPlugins.filter(plugin => 
          plugin.capabilities.canCreate
        );
        
        // Worker側で許可されている子ノードタイプを取得
        const allowedChildTypes = await nodeAdapter.workerAPI.getAllowedChildTypes?.(
          parentNode.treeNodeType
        ) || creatablePlugins.map(p => p.nodeType);
        
        // 最終的なメニューアイテムを構築
        const items = creatablePlugins
          .filter(plugin => allowedChildTypes.includes(plugin.nodeType))
          .map(plugin => ({
            nodeType: plugin.nodeType,
            label: plugin.displayName,
            description: plugin.description,
            icon: plugin.components.icon,
            group: plugin.menu.group,
            order: plugin.menu.createOrder,
            onClick: () => unifiedOperations.createNode(parentNodeId, plugin.nodeType)
          }))
          .sort((a, b) => a.order - b.order);
        
        // グループ別に整理
        const groupedItems = groupMenuItems(items);
        setMenuItems(groupedItems);
        
      } catch (error) {
        console.error('Error loading create menu items:', error);
        setMenuItems([]);
      } finally {
        setLoading(false);
      }
    }
    
    loadMenuItems();
  }, [parentNodeId]);
  
  return { menuItems, loading };
};

function groupMenuItems(items: CreateMenuItem[]): CreateMenuItem[] {
  const groups = ['basic', 'container', 'document', 'advanced'];
  const result: CreateMenuItem[] = [];
  
  for (const group of groups) {
    const groupItems = items.filter(item => item.group === group);
    if (groupItems.length > 0) {
      if (result.length > 0) {
        result.push({ type: 'divider' }); // グループ間の区切り
      }
      result.push(...groupItems);
    }
  }
  
  return result;
}
```

### DynamicCreateMenu コンポーネント

```typescript
// packages/ui-treeconsole/src/containers/DynamicCreateMenu.tsx
export const DynamicCreateMenu: React.FC<{
  parentNodeId: TreeNodeId;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}> = ({ parentNodeId, anchorEl, open, onClose }) => {
  const { menuItems, loading } = useDynamicCreateMenu(parentNodeId);
  
  if (loading) {
    return (
      <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
        <MenuItem disabled>
          <CircularProgress size={16} sx={{ mr: 1 }} />
          Loading...
        </MenuItem>
      </Menu>
    );
  }
  
  if (menuItems.length === 0) {
    return (
      <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
        <MenuItem disabled>
          <Typography color="text.secondary">
            No items can be created here
          </Typography>
        </MenuItem>
      </Menu>
    );
  }
  
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
    >
      {menuItems.map((item, index) => {
        if (item.type === 'divider') {
          return <Divider key={`divider-${index}`} />;
        }
        
        return (
          <MenuItem
            key={item.nodeType}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            sx={{
              minWidth: 200,
              '& .MuiListItemIcon-root': {
                minWidth: 36
              }
            }}
          >
            <ListItemIcon>
              <item.icon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              secondary={item.description}
              secondaryTypographyProps={{
                variant: 'caption',
                color: 'text.secondary'
              }}
            />
          </MenuItem>
        );
      })}
    </Menu>
  );
};
```

## 実装状況

### ✅ 完了した実装
1. **UIPluginDefinition インターフェース** - `packages/ui-core/src/plugins/types.ts`
2. **UIPluginRegistry** - `packages/ui-core/src/plugins/registry/UIPluginRegistry.ts`
3. **NodeDataAdapter** - `packages/ui-core/src/plugins/adapters/NodeDataAdapter.ts`
4. **UnifiedNodeOperations** - `packages/ui-core/src/plugins/operations/UnifiedNodeOperations.ts`
5. **動的メニュー生成システム** - `packages/ui-core/src/plugins/hooks/useDynamicCreateMenu.ts`
6. **DynamicCreateMenu コンポーネント** - `packages/ui-core/src/plugins/components/DynamicCreateMenu.tsx`
7. **FolderUIPlugin** - `packages/plugins/folder/src/ui/FolderUIPlugin.tsx`
8. **BaseMapUIPlugin** - `packages/plugins/basemap/src/ui/BaseMapUIPlugin.tsx`

### 🔄 次のステップ
1. **サービス実装** - NotificationService, NavigationService, DialogService
2. **Worker API統合** - NodeDataAdapterのWorkerAPI実装
3. **コンポーネント統合** - 実際のダイアログとUI統合
4. **プラグイン登録** - アプリケーション初期化での自動登録
5. **テスト実装** - 統合テストとE2Eテスト

### 📦 パッケージ構造

```
packages/
├── ui-core/
│   └── src/plugins/          # 🆕 統一プラグインシステム
│       ├── types.ts          # ✅ 標準化インターフェース
│       ├── registry/         # ✅ プラグイン登録管理
│       ├── adapters/         # ✅ Worker-UI橋渡し
│       ├── operations/       # ✅ 統一CRUD操作
│       ├── hooks/           # ✅ React統合フック
│       └── components/      # ✅ 動的UI コンポーネント
├── plugins/
│   ├── folder/              # ✅ フォルダプラグイン完全実装
│   └── basemap/             # ✅ BaseMapプラグイン更新済み
```

## まとめ

このプラグインシステム設計により以下を実現：

### 技術的利点
1. **Worker側安定性**: 既存アーキテクチャを維持し、変更リスクを回避
2. **UI統一性**: 全ノード種類で一貫したCRUD体験
3. **段階的実装**: 低リスクで段階的に移行可能
4. **高い拡張性**: 新しいノードタイプの追加が容易

### 開発者体験
1. **一貫したAPI**: プラグイン開発者にとって学習コストが低い
2. **再利用性**: UIコンポーネントの高い再利用性
3. **テスタビリティ**: 統一されたテスト手法

### ユーザー体験
1. **統一操作**: フォルダもエンティティも同じ操作感
2. **動的UI**: 状況に応じた適切なメニュー表示
3. **柔軟性**: プラグインごとの特殊な機能も利用可能

この設計により、技術的合理性とUX一貫性を両立し、保守性と拡張性を兼ね備えたプラグインシステムを実現できます。