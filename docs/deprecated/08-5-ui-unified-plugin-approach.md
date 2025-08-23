# UI層統一プラグインアプローチ：Worker側は現状維持、UI側は完全統一

## 概要

Worker側の既存アーキテクチャ（TreeNode + Entity/SubEntity分離）は技術的に合理的で変更不要。しかし、UI側では全てのノード種類（フォルダ含む）を統一的なプラグインシステムで扱うことで、一貫したUXを実現する。

## アーキテクチャの分離設計

### Worker側：現状維持（技術的最適化）

```
Worker Layer（変更なし）
├── TreeNode (treeNodeId, parentId, treeNodeType, name, etc.)
├── Entity System
│   ├── BaseMapEntity
│   ├── StyleMapEntity
│   └── ...
└── Plugin System (Entity専用)
    ├── BaseMapPlugin
    ├── StyleMapPlugin
    └── ...

メリット：
✓ 既存のデータベース設計をそのまま活用
✓ 確立されたTreeNode管理システムを維持
✓ パフォーマンス最適化された構造
✓ 移行コストゼロ
```

### UI側：完全統一（UX最適化）

```
UI Layer（新設計）
└── Unified Plugin System
    ├── FolderUIPlugin (TreeNodeのフォルダ型を扱う)
    ├── BaseMapUIPlugin (TreeNode + BaseMapEntityを扱う)
    ├── StyleMapUIPlugin (TreeNode + StyleMapEntityを扱う)
    └── ProjectUIPlugin (TreeNodeのプロジェクト型を扱う)

メリット：
✓ 全ノード種類で統一されたCRUD UX
✓ プラグイン開発者にとって一貫したAPI
✓ 動的メニュー生成の簡素化
✓ コンポーネントの再利用性向上
```

## UI層統一プラグインシステム設計

### 1. UIPluginDefinition（統一インターフェース）

```typescript
// packages/ui-core/src/plugins/types.ts
export interface UIPluginDefinition {
  // 基本情報
  nodeType: TreeNodeType;
  displayName: string;
  
  // ノードのデータソース定義
  dataSource: {
    // TreeNodeのみか、Entityも必要か
    requiresEntity: boolean;
    // エンティティタイプ（Entity必要な場合）
    entityType?: string;
  };
  
  // CRUD機能の定義
  capabilities: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canHaveChildren: boolean;
    supportsWorkingCopy: boolean;
    supportsExport: boolean;
  };
  
  // UIコンポーネント
  components: {
    icon: React.ComponentType<IconProps>;
    createDialog?: React.ComponentType<CreateDialogProps>;
    editDialog?: React.ComponentType<EditDialogProps>;
    detailPanel?: React.ComponentType<DetailPanelProps>;
    tableCell?: React.ComponentType<TableCellProps>;
    preview?: React.ComponentType<PreviewProps>;
  };
  
  // CRUD アクションフック
  hooks: {
    // Create
    beforeCreate?: (params: BeforeCreateParams) => Promise<CreateActionResult>;
    onCreateDialog?: (params: CreateDialogParams) => Promise<void>;
    afterCreate?: (params: AfterCreateParams) => Promise<void>;
    
    // Read
    onFormatDisplay?: (params: FormatDisplayParams) => Promise<string | React.ReactNode>;
    onGeneratePreview?: (params: PreviewParams) => Promise<React.ComponentType>;
    
    // Update
    beforeEdit?: (params: BeforeEditParams) => Promise<EditActionResult>;
    onEditDialog?: (params: EditDialogParams) => Promise<void>;
    afterUpdate?: (params: AfterUpdateParams) => Promise<void>;
    
    // Delete
    beforeDelete?: (params: BeforeDeleteParams) => Promise<DeleteActionResult>;
    afterDelete?: (params: AfterDeleteParams) => Promise<void>;
    
    // その他
    onContextMenu?: (params: ContextMenuParams) => Promise<ContextMenuItem[]>;
    onExport?: (params: ExportParams) => Promise<Blob>;
  };
  
  // メニュー設定
  menu: {
    createOrder: number;
    group: 'basic' | 'document' | 'container' | 'advanced';
    contextMenuItems?: ContextMenuItem[];
  };
}
```

### 2. データアダプター（Worker側との橋渡し）

```typescript
// packages/ui-core/src/plugins/adapters/NodeDataAdapter.ts
export class NodeDataAdapter {
  constructor(private workerAPI: WorkerAPI) {}
  
  // 統一されたノードデータ取得
  async getNodeData(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<UnifiedNodeData> {
    const plugin = UIPluginRegistry.get(nodeType);
    
    // 1. TreeNodeデータを取得（全ノード共通）
    const treeNode = await this.workerAPI.getTreeNode(nodeId);
    
    if (!plugin.dataSource.requiresEntity) {
      // フォルダなど：TreeNodeのみ
      return {
        treeNode,
        entity: null,
        combinedData: {
          id: treeNode.treeNodeId,
          name: treeNode.name,
          type: treeNode.treeNodeType,
          parentId: treeNode.parentId,
          createdAt: treeNode.createdAt,
          updatedAt: treeNode.updatedAt
        }
      };
    } else {
      // BaseMapなど：TreeNode + Entity
      const entity = await this.workerAPI.getEntity(nodeId, plugin.dataSource.entityType!);
      return {
        treeNode,
        entity,
        combinedData: {
          // TreeNodeの基本情報
          id: treeNode.treeNodeId,
          name: treeNode.name,
          type: treeNode.treeNodeType,
          parentId: treeNode.parentId,
          
          // Entityの詳細情報
          ...entity,
          
          // 統合されたタイムスタンプ
          createdAt: treeNode.createdAt,
          updatedAt: Math.max(treeNode.updatedAt, entity?.updatedAt || 0)
        }
      };
    }
  }
  
  // 統一されたノード作成
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
        description: data.description
      });
    } else {
      // エンティティ付きノード作成：TreeNode + Entity
      return await this.workerAPI.createNodeWithEntity({
        parentId,
        treeNodeType: nodeType,
        treeNodeData: {
          name: data.name,
          description: data.description
        },
        entityType: plugin.dataSource.entityType!,
        entityData: data
      });
    }
  }
  
  // 統一されたノード更新
  async updateNode(
    nodeId: TreeNodeId,
    nodeType: TreeNodeType,
    changes: any
  ): Promise<void> {
    const plugin = UIPluginRegistry.get(nodeType);
    
    // TreeNode更新（名前、説明など）
    if (changes.name || changes.description) {
      await this.workerAPI.updateTreeNode(nodeId, {
        name: changes.name,
        description: changes.description
      });
    }
    
    // Entity更新（プラグイン固有データ）
    if (plugin.dataSource.requiresEntity && hasEntityChanges(changes)) {
      await this.workerAPI.updateEntity(
        nodeId, 
        plugin.dataSource.entityType!, 
        changes
      );
    }
  }
}

interface UnifiedNodeData {
  treeNode: TreeNode;
  entity: any | null;
  combinedData: any; // UIで使用する統合データ
}
```

### 3. 具体的なプラグイン実装例

#### フォルダプラグイン

```typescript
// packages/ui-core/src/plugins/basic/FolderPlugin.tsx
export const FolderUIPlugin: UIPluginDefinition = {
  nodeType: 'folder',
  displayName: 'Folder',
  
  dataSource: {
    requiresEntity: false // TreeNodeのみ
  },
  
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: true,
    supportsWorkingCopy: false,
    supportsExport: false
  },
  
  components: {
    icon: FolderIcon,
    createDialog: FolderCreateDialog,
    editDialog: FolderEditDialog,
    tableCell: FolderTableCell
  },
  
  hooks: {
    beforeCreate: async ({ parentId, formData }) => {
      // フォルダ名の重複チェック
      const siblings = await nodeAdapter.getChildren(parentId);
      if (siblings.some(s => s.name === formData.name && s.type === 'folder')) {
        return {
          proceed: false,
          message: 'Folder name already exists'
        };
      }
      return { proceed: true };
    },
    
    onCreateDialog: async ({ parentId, onSubmit }) => {
      // シンプルな名前入力ダイアログ
      const result = await showNameInputDialog('Create Folder');
      if (result) {
        await onSubmit({ name: result, description: '' });
      }
    },
    
    beforeDelete: async ({ nodeIds }) => {
      // 子を持つフォルダの削除確認
      const hasChildren = await Promise.all(
        nodeIds.map(id => nodeAdapter.hasChildren(id))
      );
      
      if (hasChildren.some(Boolean)) {
        return {
          proceed: true,
          confirmMessage: 'Some folders contain items. Delete all contents?'
        };
      }
      return { proceed: true };
    },
    
    onContextMenu: async ({ nodeId }) => {
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
        }
      ];
    }
  },
  
  menu: {
    createOrder: 1,
    group: 'basic'
  }
};

// フォルダ作成ダイアログ（シンプル）
const FolderCreateDialog: React.FC<CreateDialogProps> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  
  return (
    <Dialog open onClose={onCancel}>
      <DialogTitle>Create Folder</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Folder Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button 
          onClick={() => onSubmit({ name })}
          disabled={!name.trim()}
          variant="contained"
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

#### BaseMapプラグイン

```typescript
// packages/plugins/basemap/src/ui/BaseMapUIPlugin.tsx
export const BaseMapUIPlugin: UIPluginDefinition = {
  nodeType: 'basemap',
  displayName: 'Base Map',
  
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
    supportsWorkingCopy: true,
    supportsExport: true
  },
  
  components: {
    icon: MapIcon,
    createDialog: BaseMapCreateDialog,
    editDialog: BaseMapEditDialog,
    detailPanel: BaseMapDetailPanel,
    preview: MapPreviewComponent
  },
  
  hooks: {
    beforeCreate: async ({ parentId, context }) => {
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
    
    onCreateDialog: async ({ parentId, onSubmit }) => {
      // 地図作成専用の詳細ダイアログ
      const mapData = await showMapCreateDialog();
      if (mapData) {
        await onSubmit({
          name: mapData.name,
          center: mapData.center,
          zoom: mapData.zoom,
          style: mapData.style
        });
      }
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
    },
    
    onContextMenu: async ({ nodeId }) => {
      return [
        {
          label: 'Open in Map Editor',
          icon: 'edit_location',
          action: () => openMapEditor(nodeId)
        },
        {
          label: 'Export as GeoJSON',
          icon: 'download',
          action: () => exportAsGeoJSON(nodeId)
        },
        {
          label: 'Duplicate Map',
          icon: 'content_copy',
          action: () => duplicateMap(nodeId)
        }
      ];
    }
  },
  
  menu: {
    createOrder: 10,
    group: 'document'
  }
};
```

### 4. 統一されたCRUD操作UI

```typescript
// packages/ui-treeconsole/src/containers/UnifiedNodeOperations.tsx
export const UnifiedNodeOperations = () => {
  const nodeAdapter = useNodeDataAdapter();
  
  // 統一された作成処理
  const handleCreate = async (parentId: TreeNodeId, nodeType: TreeNodeType) => {
    const plugin = UIPluginRegistry.get(nodeType);
    
    // プラグインのbeforeCreateフックを実行
    const beforeResult = await plugin.hooks.beforeCreate?.({
      parentId,
      nodeType,
      context: getCurrentContext()
    });
    
    if (!beforeResult?.proceed) {
      if (beforeResult?.message) {
        showNotification(beforeResult.message, 'warning');
      }
      return;
    }
    
    // プラグインのカスタムダイアログまたはデフォルトダイアログを表示
    if (plugin.hooks.onCreateDialog) {
      await plugin.hooks.onCreateDialog({
        parentId,
        nodeType,
        onSubmit: async (data) => {
          const nodeId = await nodeAdapter.createNode(parentId, nodeType, data);
          await plugin.hooks.afterCreate?.({ nodeId, data, parentId });
          showNotification(`${plugin.displayName} created successfully`);
        }
      });
    } else {
      // デフォルトの作成ダイアログ
      await showDefaultCreateDialog(parentId, nodeType);
    }
  };
  
  // 統一された編集処理
  const handleEdit = async (nodeId: TreeNodeId, nodeType: TreeNodeType) => {
    const plugin = UIPluginRegistry.get(nodeType);
    const nodeData = await nodeAdapter.getNodeData(nodeId, nodeType);
    
    const beforeResult = await plugin.hooks.beforeEdit?.({
      nodeId,
      nodeType,
      currentData: nodeData.combinedData
    });
    
    if (!beforeResult?.proceed) {
      if (beforeResult?.message) {
        showNotification(beforeResult.message, 'warning');
      }
      return;
    }
    
    if (plugin.hooks.onEditDialog) {
      await plugin.hooks.onEditDialog({
        nodeId,
        nodeType,
        currentData: nodeData.combinedData,
        onSubmit: async (changes) => {
          await nodeAdapter.updateNode(nodeId, nodeType, changes);
          await plugin.hooks.afterUpdate?.({ nodeId, changes });
          showNotification(`${plugin.displayName} updated successfully`);
        }
      });
    }
  };
  
  // 統一された削除処理
  const handleDelete = async (nodeIds: TreeNodeId[]) => {
    // 複数ノードの場合、タイプごとにグループ化
    const nodesByType = await groupNodesByType(nodeIds);
    
    for (const [nodeType, nodes] of nodesByType) {
      const plugin = UIPluginRegistry.get(nodeType);
      
      const beforeResult = await plugin.hooks.beforeDelete?.({
        nodeIds: nodes.map(n => n.id),
        entities: nodes
      });
      
      if (!beforeResult?.proceed) {
        continue;
      }
      
      if (beforeResult?.confirmMessage) {
        const confirmed = await showConfirmDialog(beforeResult.confirmMessage);
        if (!confirmed) continue;
      }
      
      // 削除実行
      await Promise.all(nodes.map(node => 
        nodeAdapter.deleteNode(node.id, nodeType)
      ));
      
      await plugin.hooks.afterDelete?.({
        nodeIds: nodes.map(n => n.id)
      });
    }
  };
  
  return {
    handleCreate,
    handleEdit,
    handleDelete
  };
};
```

## このアプローチの利点

### 1. **Worker側：安定性維持**
- 既存のアーキテクチャを変更しない
- パフォーマンス最適化された構造を維持
- 移行リスクなし

### 2. **UI側：統一されたUX**
- フォルダもエンティティ付きノードも同じ操作感
- プラグイン開発者にとって一貫したAPI
- 動的なメニュー生成とコンテキストメニュー

### 3. **開発効率**
- 新しいノードタイプの追加が容易
- UIコンポーネントの再利用性
- テストの簡素化

### 4. **柔軟性**
- Worker側とUI側で異なる最適化戦略
- 段階的な実装が可能
- 既存機能への影響最小限

この設計により、技術的な合理性とUXの一貫性を両立できます。