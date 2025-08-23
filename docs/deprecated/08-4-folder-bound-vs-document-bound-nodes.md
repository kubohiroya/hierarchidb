# フォルダ紐づき vs ドキュメント紐づきノードの設計

## 概要

HierarchiDBのノードには2つの主要な紐づきパターンがある：
1. **フォルダ紐づき**: Project型ノード - フォルダとしての性質を持ち、子ノードを持つ
2. **ドキュメント紐づき**: BaseMap、StyleMap等 - 単一エンティティとして機能し、通常子ノードは持たない

この設計により、階層構造を持つプロジェクト管理と、個別のドキュメント管理を適切に分離する。

## アーキテクチャの詳細設計

### 基本構造の見直し

```
Unified Plugin System
├── Container Plugins（コンテナ型）
│   ├── Folder Plugin - 汎用フォルダ
│   └── Project Plugin - プロジェクト管理フォルダ
└── Document Plugins（ドキュメント型）
    ├── BaseMap Plugin - 地図エンティティ
    ├── StyleMap Plugin - スタイルエンティティ
    └── Routes Plugin - ルートエンティティ
```

### プラグインの基底クラス設計

#### 1. ContainerPluginBase（コンテナ型の基底）

```typescript
// packages/core/src/plugins/ContainerPluginBase.ts
export abstract class ContainerPluginBase<TEntity extends ContainerEntity> {
  abstract nodeType: TreeNodeType;
  
  // コンテナ型の共通機能
  readonly capabilities = {
    canHaveChildren: true,
    isContainer: true,
    supportsBulkOperations: true,
    supportsSearch: true
  };
  
  // 子ノード管理
  async getChildren(nodeId: TreeNodeId): Promise<TreeNode[]> {
    return await this.coreDB.getChildren(nodeId);
  }
  
  async addChild(parentId: TreeNodeId, childData: any): Promise<TreeNodeId> {
    // 子ノード追加の共通処理
    return await this.createChild(parentId, childData);
  }
  
  // 権限管理（コンテナ型で重要）
  async checkPermissions(nodeId: TreeNodeId, action: string, userId: string): Promise<boolean> {
    const entity = await this.get(nodeId);
    return await this.validateAccess(entity, action, userId);
  }
  
  // 一括操作
  async bulkOperation(nodeIds: TreeNodeId[], operation: string): Promise<void> {
    // コンテナ型特有の一括処理
  }
  
  protected abstract validateAccess(entity: TEntity, action: string, userId: string): Promise<boolean>;
  protected abstract createChild(parentId: TreeNodeId, childData: any): Promise<TreeNodeId>;
}

interface ContainerEntity extends BaseEntity {
  // コンテナ型の共通プロパティ
  permissions?: {
    owner: string;
    readers: string[];
    writers: string[];
    admins: string[];
  };
  settings?: {
    defaultChildType?: TreeNodeType;
    allowedChildTypes?: TreeNodeType[];
    maxChildren?: number;
    autoSort?: boolean;
  };
}
```

#### 2. DocumentPluginBase（ドキュメント型の基底）

```typescript
// packages/core/src/plugins/DocumentPluginBase.ts
export abstract class DocumentPluginBase<TEntity extends DocumentEntity> {
  abstract nodeType: TreeNodeType;
  
  // ドキュメント型の共通機能
  readonly capabilities = {
    canHaveChildren: false,
    isContainer: false,
    supportsWorkingCopy: true,
    supportsVersioning: true,
    supportsExport: true
  };
  
  // Working Copy 管理
  async createWorkingCopy(nodeId: TreeNodeId): Promise<TEntity & WorkingCopyMixin> {
    const entity = await this.get(nodeId);
    return {
      ...entity,
      workingCopyId: generateId(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false
    };
  }
  
  async commitWorkingCopy(workingCopyId: string): Promise<TEntity> {
    // Working Copy のコミット処理
    const workingCopy = await this.getWorkingCopy(workingCopyId);
    const committed = await this.update(workingCopy.workingCopyOf, workingCopy);
    await this.deleteWorkingCopy(workingCopyId);
    return committed;
  }
  
  // バージョン管理
  async getVersionHistory(nodeId: TreeNodeId): Promise<VersionInfo[]> {
    return await this.versionDB.getVersions(nodeId);
  }
  
  // エクスポート
  async export(nodeId: TreeNodeId, format: string): Promise<Blob> {
    const entity = await this.get(nodeId);
    return await this.formatExport(entity, format);
  }
  
  protected abstract formatExport(entity: TEntity, format: string): Promise<Blob>;
  protected abstract getWorkingCopy(workingCopyId: string): Promise<TEntity & WorkingCopyMixin>;
}

interface DocumentEntity extends BaseEntity {
  // ドキュメント型の共通プロパティ
  version: number;
  lastModifiedBy?: string;
  contentHash?: string;
  size?: number;
  mimeType?: string;
}
```

## 具体的なプラグイン実装

### 1. Project Plugin（フォルダ紐づき）

```typescript
// packages/plugins/core-project/src/worker/ProjectPlugin.ts
export class ProjectPlugin extends ContainerPluginBase<ProjectEntity> {
  nodeType = 'project' as TreeNodeType;
  
  database = {
    dbName: 'CoreDB',
    tableName: 'projects',
    schema: 'nodeId, name, description, settings, permissions, createdAt, updatedAt',
    version: 1
  };
  
  async create(parentId: TreeNodeId, data: Partial<ProjectEntity>): Promise<ProjectEntity> {
    const entity: ProjectEntity = {
      nodeId: generateId(),
      parentId,
      name: data.name || 'New Project',
      description: data.description || '',
      settings: {
        defaultChildType: 'folder',
        allowedChildTypes: ['folder', 'basemap', 'stylemap', 'routes', '_shapes_buggy'],
        autoSort: true
      },
      permissions: {
        owner: data.permissions?.owner || 'current-user',
        readers: data.permissions?.readers || [],
        writers: data.permissions?.writers || [],
        admins: data.permissions?.admins || []
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    await this.db.projects.add(entity);
    return entity;
  }
  
  protected async validateAccess(entity: ProjectEntity, action: string, userId: string): Promise<boolean> {
    const { permissions } = entity;
    
    switch (action) {
      case 'read':
        return permissions.readers.includes(userId) || 
               permissions.writers.includes(userId) || 
               permissions.admins.includes(userId) ||
               permissions.owner === userId;
      
      case 'write':
        return permissions.writers.includes(userId) || 
               permissions.admins.includes(userId) ||
               permissions.owner === userId;
      
      case 'admin':
        return permissions.admins.includes(userId) ||
               permissions.owner === userId;
      
      case 'delete':
        return permissions.owner === userId;
      
      default:
        return false;
    }
  }
  
  protected async createChild(parentId: TreeNodeId, childData: any): Promise<TreeNodeId> {
    const project = await this.get(parentId);
    
    // プロジェクト設定に基づいて子ノード作成を制御
    if (project.settings.allowedChildTypes && 
        !project.settings.allowedChildTypes.includes(childData.type)) {
      throw new Error(`Child type ${childData.type} not allowed in this project`);
    }
    
    if (project.settings.maxChildren && 
        (await this.getChildren(parentId)).length >= project.settings.maxChildren) {
      throw new Error('Maximum children limit reached');
    }
    
    // 子ノードを作成
    const childPlugin = this.registry.get(childData.type);
    return await childPlugin.create(parentId, childData);
  }
  
  // プロジェクト固有の機能
  async getProjectStatistics(nodeId: TreeNodeId): Promise<ProjectStats> {
    const children = await this.getChildren(nodeId);
    const stats: ProjectStats = {
      totalNodes: children.length,
      nodeTypes: {},
      lastActivity: 0
    };
    
    for (const child of children) {
      stats.nodeTypes[child.type] = (stats.nodeTypes[child.type] || 0) + 1;
      stats.lastActivity = Math.max(stats.lastActivity, child.updatedAt);
    }
    
    return stats;
  }
  
  async exportProject(nodeId: TreeNodeId, format: 'zip' | 'json'): Promise<Blob> {
    const project = await this.get(nodeId);
    const children = await this.getAllDescendants(nodeId);
    
    if (format === 'json') {
      const exportData = {
        project,
        children: await Promise.all(
          children.map(child => this.registry.get(child.type).get(child.nodeId))
        )
      };
      return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    }
    
    // ZIP format implementation
    return await this.createZipExport(project, children);
  }
}

interface ProjectEntity extends ContainerEntity {
  name: string;
  description: string;
}

interface ProjectStats {
  totalNodes: number;
  nodeTypes: Record<string, number>;
  lastActivity: number;
}
```

### 2. BaseMap Plugin（ドキュメント紐づき）

```typescript
// packages/plugins/basemap/src/worker/BaseMapPlugin.ts
export class BaseMapPlugin extends DocumentPluginBase<BaseMapEntity> {
  nodeType = 'basemap' as TreeNodeType;
  
  database = {
    dbName: 'CoreDB',
    tableName: 'basemaps',
    schema: 'nodeId, name, center, zoom, style, bounds, createdAt, updatedAt',
    version: 1
  };
  
  async create(parentId: TreeNodeId, data: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    const entity: BaseMapEntity = {
      nodeId: generateId(),
      parentId,
      name: data.name || 'New Base Map',
      center: data.center || [139.6917, 35.6895], // Tokyo
      zoom: data.zoom || 10,
      style: data.style || 'streets-v11',
      bounds: data.bounds || null,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      contentHash: this.calculateHash(data),
      mimeType: 'application/vnd.mapbox-style+json'
    };
    
    await this.db.basemaps.add(entity);
    return entity;
  }
  
  protected async formatExport(entity: BaseMapEntity, format: string): Promise<Blob> {
    switch (format) {
      case 'geojson':
        const geoData = this.convertToGeoJSON(entity);
        return new Blob([JSON.stringify(geoData)], { type: 'application/geo+json' });
      
      case 'mapbox-style':
        const styleData = this.convertToMapboxStyle(entity);
        return new Blob([JSON.stringify(styleData)], { type: 'application/vnd.mapbox-style+json' });
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  protected async getWorkingCopy(workingCopyId: string): Promise<BaseMapEntity & WorkingCopyMixin> {
    return await this.ephemeralDB.workingCopies.get(workingCopyId);
  }
  
  // BaseMap固有の機能
  async updateMapStyle(nodeId: TreeNodeId, styleConfig: any): Promise<BaseMapEntity> {
    const entity = await this.get(nodeId);
    const updated = {
      ...entity,
      style: styleConfig,
      updatedAt: Date.now(),
      version: entity.version + 1,
      contentHash: this.calculateHash(styleConfig)
    };
    
    await this.db.basemaps.put(updated);
    return updated;
  }
  
  async getMapBounds(nodeId: TreeNodeId): Promise<[number, number, number, number] | null> {
    const entity = await this.get(nodeId);
    return entity.bounds;
  }
  
  private calculateHash(data: any): string {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)))
      .then(buffer => Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''));
  }
}

interface BaseMapEntity extends DocumentEntity {
  name: string;
  center: [number, number];
  zoom: number;
  style: string;
  bounds: [number, number, number, number] | null;
}
```

## UI層での対応

### 1. プラグインタイプの判定

```typescript
// packages/ui-core/src/plugins/PluginTypeDetector.ts
export class PluginTypeDetector {
  static isContainerType(nodeType: TreeNodeType): boolean {
    const plugin = UIPluginRegistry.get(nodeType);
    return plugin?.capabilities?.isContainer || false;
  }
  
  static canHaveChildren(nodeType: TreeNodeType): boolean {
    const plugin = UIPluginRegistry.get(nodeType);
    return plugin?.capabilities?.canHaveChildren || false;
  }
  
  static supportsWorkingCopy(nodeType: TreeNodeType): boolean {
    const plugin = UIPluginRegistry.get(nodeType);
    return plugin?.capabilities?.supportsWorkingCopy || false;
  }
}
```

### 2. 動的メニュー生成の改良

```typescript
// packages/ui-treeconsole/src/hooks/useDynamicCreateMenu.ts
export const useDynamicCreateMenu = (parentNodeId: TreeNodeId) => {
  const [menuItems, setMenuItems] = useState<CreateMenuItem[]>([]);
  
  useEffect(() => {
    async function loadMenuItems() {
      const parentNode = await workerAPI.getNode(parentNodeId);
      const parentPlugin = UIPluginRegistry.get(parentNode.type);
      
      if (!parentPlugin.capabilities.canHaveChildren) {
        setMenuItems([]); // 子を持てないノードの場合は空
        return;
      }
      
      // 親ノードが許可する子ノードタイプを取得
      const allowedTypes = await workerAPI.getAllowedChildTypes(parentNode.type);
      
      // コンテナ型とドキュメント型で分けてメニューを構築
      const containerItems = allowedTypes
        .filter(type => PluginTypeDetector.isContainerType(type))
        .map(type => createMenuItem(type, 'container'));
        
      const documentItems = allowedTypes
        .filter(type => !PluginTypeDetector.isContainerType(type))
        .map(type => createMenuItem(type, 'document'));
      
      // グループ分けしてメニューに表示
      const items = [
        ...containerItems,
        ...(containerItems.length > 0 && documentItems.length > 0 ? [{ type: 'divider' }] : []),
        ...documentItems
      ];
      
      setMenuItems(items);
    }
    
    loadMenuItems();
  }, [parentNodeId]);
  
  return menuItems;
};
```

### 3. コンテキストメニューの動的制御

```typescript
// packages/ui-treeconsole/src/containers/DynamicNodeContextMenu.tsx
export const DynamicNodeContextMenu: React.FC<NodeContextMenuProps> = ({
  nodeType,
  nodeId,
  ...props
}) => {
  const [contextMenuItems, setContextMenuItems] = useState<ContextMenuItem[]>([]);
  
  useEffect(() => {
    async function loadContextMenu() {
      const plugin = UIPluginRegistry.get(nodeType);
      const baseItems = getBaseContextMenuItems(plugin.capabilities);
      
      // プラグイン固有のメニュー項目を取得
      const customItems = await plugin.hooks?.onContextMenu?.({
        nodeId,
        nodeType
      }) || [];
      
      setContextMenuItems([...baseItems, ...customItems]);
    }
    
    loadContextMenu();
  }, [nodeType, nodeId]);
  
  return (
    <NodeContextMenu {...props}>
      {contextMenuItems.map((item, index) => (
        <MenuItem key={index} onClick={item.action}>
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText>{item.label}</ListItemText>
        </MenuItem>
      ))}
    </NodeContextMenu>
  );
};

function getBaseContextMenuItems(capabilities: PluginCapabilities): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  
  if (capabilities.canHaveChildren) {
    items.push({
      label: 'Create...',
      icon: <AddIcon />,
      action: () => showCreateMenu()
    });
  }
  
  if (capabilities.supportsWorkingCopy) {
    items.push({
      label: 'Edit',
      icon: <EditIcon />,
      action: () => startEditMode()
    });
  }
  
  if (capabilities.supportsExport) {
    items.push({
      label: 'Export',
      icon: <ExportIcon />,
      action: () => showExportDialog()
    });
  }
  
  return items;
}
```

## プラグイン定義の比較

### Project Plugin（フォルダ紐づき）

```typescript
export const ProjectUIPlugin: UIPluginDefinition = {
  nodeType: 'project',
  displayName: 'Project',
  
  capabilities: {
    isContainer: true,
    canHaveChildren: true,
    supportsBulkOperations: true,
    supportsPermissions: true
  },
  
  icon: {
    type: 'material',
    value: 'folder_special',
    color: '#2196F3'
  },
  
  components: {
    createDialog: ProjectCreateDialog,
    editDialog: ProjectEditDialog,
    detailPanel: ProjectDetailPanel,
    permissionsDialog: ProjectPermissionsDialog
  },
  
  menu: {
    createOrder: 1,
    group: 'container',
    contextMenuItems: [
      {
        label: 'Project Settings',
        icon: 'settings',
        action: 'open-settings'
      },
      {
        label: 'Export Project',
        icon: 'archive',
        action: 'export-project'
      }
    ]
  }
};
```

### BaseMap Plugin（ドキュメント紐づき）

```typescript
export const BaseMapUIPlugin: UIPluginDefinition = {
  nodeType: 'basemap',
  displayName: 'Base Map',
  
  capabilities: {
    isContainer: false,
    canHaveChildren: false,
    supportsWorkingCopy: true,
    supportsVersioning: true,
    supportsExport: true
  },
  
  icon: {
    type: 'material',
    value: 'map',
    color: '#4CAF50'
  },
  
  components: {
    createDialog: BaseMapCreateDialog,
    editDialog: BaseMapEditDialog,
    preview: MapPreviewComponent
  },
  
  menu: {
    createOrder: 10,
    group: 'document',
    contextMenuItems: [
      {
        label: 'Open in Map Editor',
        icon: 'edit_location',
        action: 'open-map-editor'
      },
      {
        label: 'Export as GeoJSON',
        icon: 'download',
        action: 'export-geojson'
      }
    ]
  }
};
```

## まとめ

### アーキテクチャの利点

1. **明確な責務分離**
   - コンテナ型：階層管理、権限管理、一括操作
   - ドキュメント型：コンテンツ管理、バージョン管理、エクスポート

2. **適切な継承構造**
   - 共通機能は基底クラスで実装
   - 型固有の機能は個別プラグインで実装

3. **柔軟な拡張性**
   - 新しいコンテナ型（例：ワークスペース）を容易に追加
   - 新しいドキュメント型（例：レポート）を容易に追加

4. **UI層での適切な制御**
   - プラグインの機能に応じた動的UI
   - コンテキストメニューの自動生成

この設計により、Projectノードはフォルダとしての性質を持ちながら、BaseMapなどのドキュメント型ノードとは異なる適切な管理が可能になります。