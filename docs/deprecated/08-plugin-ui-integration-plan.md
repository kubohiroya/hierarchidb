# プラグインシステムUI統合計画

## 概要

HierarchiDBのプラグインシステムは、Worker側で完全に実装されているが、UI層との統合が未完成である。本文書では、プラグインによる動的なUI拡張を実現するための実装計画を示す。

## 現状分析

### 実装済みの機能

#### Worker側（Backend）
1. **UnifiedPluginDefinition**: プラグイン定義の完全な仕様
2. **UnifiedNodeTypeRegistry**: プラグインの登録・管理
3. **NodeLifecycleManager**: ライフサイクルフックの実行
4. **EntityHandler**: エンティティ操作の抽象化

#### UI側（Frontend）
1. **NodeContextMenu**: 基本的なコンテキストメニュー（静的）
2. **NodeTypeIcon**: 基本的なアイコン表示（静的）
3. **TreeConsole**: テーブル表示とパンくずリスト

### 未実装の機能

1. **動的メニュー生成**: 登録プラグインに基づくCreateメニュー
2. **動的アイコン取得**: プラグインごとのカスタムアイコン
3. **動的ダイアログ**: プラグインごとの作成・編集ダイアログ
4. **プラグイン情報のRPC**: Worker→UIのメタデータ共有

## 実装計画

### Phase 1: プラグインメタデータAPI（1週目）

#### 1.1 WorkerAPI拡張

```typescript
// packages/api/src/WorkerAPI.ts
export interface WorkerAPI {
  // 既存のインターフェース...
  
  // プラグイン関連API（新規追加）
  getRegisteredNodeTypes(): Promise<NodeTypeMetadata[]>;
  getNodeTypeDefinition(nodeType: TreeNodeType): Promise<NodeTypeMetadata>;
  getAllowedChildTypes(parentType: TreeNodeType): Promise<TreeNodeType[]>;
  getNodeTypeIcon(nodeType: TreeNodeType): Promise<IconDefinition>;
}

export interface NodeTypeMetadata {
  nodeType: TreeNodeType;
  displayName: string;
  icon?: IconDefinition;
  allowedChildren?: TreeNodeType[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  dialogComponent?: string;
  formComponent?: string;
}

export interface IconDefinition {
  type: 'material' | 'custom' | 'svg';
  value: string; // Material icon name, component path, or SVG string
  color?: string;
}
```

#### 1.2 WorkerAPIAdapter実装

```typescript
// packages/registry/src/adapters/PluginMetadataAdapter.ts
export class PluginMetadataAdapter {
  constructor(private workerAPI: WorkerAPI) {}
  
  async getCreateMenuItems(parentType?: TreeNodeType): Promise<CreateMenuItem[]> {
    const nodeTypes = await this.workerAPI.getRegisteredNodeTypes();
    const allowedTypes = parentType 
      ? await this.workerAPI.getAllowedChildTypes(parentType)
      : nodeTypes.map(nt => nt.nodeType);
    
    return nodeTypes
      .filter(nt => allowedTypes.includes(nt.nodeType))
      .map(nt => ({
        nodeType: nt.nodeType,
        label: nt.displayName,
        icon: nt.icon,
        onClick: () => this.createNode(nt.nodeType)
      }));
  }
  
  private async createNode(nodeType: TreeNodeType) {
    const metadata = await this.workerAPI.getNodeTypeDefinition(nodeType);
    if (metadata.dialogComponent) {
      // 動的にダイアログコンポーネントをロード
      await this.openCreateDialog(metadata);
    }
  }
}
```

### Phase 2: 動的UI コンポーネント（2週目）

#### 2.1 プラグインアイコンプロバイダー

```typescript
// packages/ui-core/src/plugins/PluginIconProvider.tsx
export const PluginIconProvider: React.FC<{
  nodeType: TreeNodeType;
  size?: 'small' | 'medium' | 'large';
}> = ({ nodeType, size = 'medium' }) => {
  const [icon, setIcon] = useState<IconDefinition | null>(null);
  const { workerAPI } = useWorkerAPI();
  
  useEffect(() => {
    workerAPI.getNodeTypeIcon(nodeType).then(setIcon);
  }, [nodeType]);
  
  if (!icon) return <DefaultIcon />;
  
  switch (icon.type) {
    case 'material':
      return <MaterialIcon name={icon.value} size={size} />;
    case 'custom':
      return <DynamicIcon path={icon.value} size={size} />;
    case 'svg':
      return <SvgIcon svg={icon.value} size={size} />;
  }
};
```

#### 2.2 動的メニュー生成

```typescript
// packages/ui-treeconsole/src/containers/common/DynamicNodeContextMenu.tsx
export function DynamicNodeContextMenu({ 
  nodeType,
  parentType,
  ...props 
}: NodeContextMenuProps) {
  const [menuItems, setMenuItems] = useState<CreateMenuItem[]>([]);
  const adapter = usePluginMetadataAdapter();
  
  useEffect(() => {
    adapter.getCreateMenuItems(parentType).then(setMenuItems);
  }, [parentType]);
  
  return (
    <NodeContextMenu {...props}>
      {/* Create サブメニューを動的に生成 */}
      <MenuItem onClick={handleAddMenuClick}>
        <ListItemIcon><AddIcon /></ListItemIcon>
        <ListItemText>Create</ListItemText>
        <ChevronRightIcon />
      </MenuItem>
      
      <Menu open={createMenuOpen}>
        {menuItems.map(item => (
          <MenuItem key={item.nodeType} onClick={item.onClick}>
            <ListItemIcon>
              <PluginIconProvider nodeType={item.nodeType} size="small" />
            </ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </NodeContextMenu>
  );
}
```

### Phase 3: プラグインダイアログシステム（3週目）

#### 3.1 ダイアログレジストリ

```typescript
// packages/ui-core/src/plugins/DialogRegistry.ts
export class DialogRegistry {
  private static instance: DialogRegistry;
  private dialogs = new Map<TreeNodeType, React.ComponentType<DialogProps>>();
  
  register(nodeType: TreeNodeType, component: React.ComponentType<DialogProps>) {
    this.dialogs.set(nodeType, component);
  }
  
  async loadDialog(nodeType: TreeNodeType): Promise<React.ComponentType<DialogProps>> {
    if (this.dialogs.has(nodeType)) {
      return this.dialogs.get(nodeType)!;
    }
    
    // 動的インポート
    const metadata = await workerAPI.getNodeTypeDefinition(nodeType);
    if (metadata.dialogComponent) {
      const module = await import(metadata.dialogComponent);
      const DialogComponent = module.default;
      this.register(nodeType, DialogComponent);
      return DialogComponent;
    }
    
    // デフォルトダイアログ
    return DefaultNodeDialog;
  }
}
```

#### 3.2 プラグインダイアログローダー

```typescript
// packages/ui-core/src/plugins/PluginDialogLoader.tsx
export const PluginDialogLoader: React.FC<{
  nodeType: TreeNodeType;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}> = ({ nodeType, open, onClose, onSubmit }) => {
  const [DialogComponent, setDialogComponent] = useState<React.ComponentType | null>(null);
  
  useEffect(() => {
    if (open && nodeType) {
      DialogRegistry.getInstance()
        .loadDialog(nodeType)
        .then(setDialogComponent);
    }
  }, [open, nodeType]);
  
  if (!DialogComponent) return null;
  
  return (
    <Suspense fallback={<LoadingDialog />}>
      <DialogComponent
        open={open}
        onClose={onClose}
        onSubmit={onSubmit}
        nodeType={nodeType}
      />
    </Suspense>
  );
};
```

### Phase 4: プラグイン例の実装（4週目）

#### 4.1 BaseMapプラグインのUI実装

```typescript
// packages/plugins/basemap/src/ui/BaseMapDialog.tsx
export const BaseMapDialog: React.FC<DialogProps> = ({ 
  open, 
  onClose, 
  onSubmit 
}) => {
  const [formData, setFormData] = useState<BaseMapFormData>({
    name: '',
    center: [0, 0],
    zoom: 10,
    style: 'streets-v11'
  });
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle>Create Base Map</DialogTitle>
      <DialogContent>
        <TextField
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <MapStyleSelector
          value={formData.style}
          onChange={(style) => setFormData({ ...formData, style })}
        />
        <CoordinatePicker
          value={formData.center}
          onChange={(center) => setFormData({ ...formData, center })}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} variant="contained">
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// アイコン定義
export const BaseMapIcon: IconDefinition = {
  type: 'material',
  value: 'map',
  color: '#4CAF50'
};
```

#### 4.2 プラグイン登録

```typescript
// packages/plugins/basemap/src/openstreetmap-type.ts
import { BaseMapUnifiedDefinition } from './definitions/BaseMapDefinition';
import { BaseMapDialog } from './ui/BaseMapDialog';
import { BaseMapIcon } from './ui/BaseMapIcon';

// Worker側で登録
registry.registerPlugin(BaseMapUnifiedDefinition);

// UI側で登録
DialogRegistry.getInstance().register('basemap', BaseMapDialog);
IconRegistry.getInstance().register('basemap', BaseMapIcon);
```

## 実装優先順位

1. **Phase 1 (必須)**: プラグインメタデータAPI - UIとWorkerの連携基盤
2. **Phase 2 (重要)**: 動的UIコンポーネント - ユーザー体験の向上
3. **Phase 3 (重要)**: ダイアログシステム - ノード作成・編集の実現
4. **Phase 4 (参考)**: 具体的なプラグイン実装例

## 技術的考慮事項

### パフォーマンス
- 動的インポートによる遅延ロード
- メタデータのキャッシング
- アイコンのメモ化

### 型安全性
- TypeScriptジェネリクスによる型推論
- プラグイン定義の型チェック
- RPC通信の型安全性

### 拡張性
- プラグイン間の依存関係管理
- バージョン互換性
- ホットリロード対応

## テスト戦略

### ユニットテスト
- プラグインレジストリのテスト
- メタデータ取得のテスト
- ダイアログローダーのテスト

### 統合テスト
- Worker-UI間の通信テスト
- プラグインライフサイクルテスト
- メニュー生成テスト

### E2Eテスト
- ノード作成フローのテスト
- プラグインダイアログのテスト
- アイコン表示のテスト

## まとめ

現在のプラグインシステムは、Worker側で完全に実装されているが、UI層との統合が不足している。この計画に従って実装することで、以下が実現される：

1. **動的なCreateメニュー**: 登録されたプラグインに基づくメニュー生成
2. **カスタムアイコン**: プラグインごとの独自アイコン
3. **専用ダイアログ**: ノードタイプごとの作成・編集UI
4. **完全な拡張性**: 新しいノードタイプの追加が容易

実装は段階的に進め、各フェーズで動作確認を行いながら進める。