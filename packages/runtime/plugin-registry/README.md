# @hierarchidb/runtime-plugin-registry

プラグイン管理システムの中核となるレジストリ実装パッケージです。プラグインの自動検出、依存関係解決、ライフサイクル管理機能を提供します。

## 概要

このパッケージは、HierarchiDBのプラグインシステムの基盤となる以下の機能を提供します：

- **プラグイン自動検出**: package.jsonの依存関係から自動的にプラグインを発見
- **依存関係解決**: トポロジカルソートによる正しい読み込み順序の決定
- **循環依存検出**: DFSアルゴリズムによる循環依存の検出と防止
- **プラグイン管理API**: 登録、削除、リセット、ヘルスチェック機能

## アーキテクチャ

### レイヤー構造

```
┌─────────────────────────────────────┐
│         Application Layer           │
│         (app/package.json)          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      Plugin Registry Layer          │
│    (このパッケージ)                    │
│  - SimplePluginDiscovery           │
│  - PluginManagementService         │
│  - NodeTypeRegistry                │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      Individual Plugins             │
│  - folder-plugin                    │
│  - basemap-plugin                   │
│  - spreadsheet-plugin               │
│  - stylemap-plugin                  │
│  - shape-plugin                     │
└─────────────────────────────────────┘
```

## プラグイン自動検出システム

### 1. 検出メカニズム

```typescript
// SimplePluginDiscovery.ts
export class SimplePluginDiscovery {
  private static readonly NODE_TYPE_PLUGIN_PATTERN = 
    /^@hierarchidb\/node-type-(.+)-plugin$/;
  
  /**
   * package.jsonの依存関係からプラグインを自動検出
   */
  discoverPluginsFromPackageJson(packageJson: PackageJson): NodeType[] {
    const plugins: NodeType[] = [];
    
    for (const packageName of Object.keys(packageJson.dependencies || {})) {
      const pluginName = this.extractPluginName(packageName);
      if (pluginName) {
        plugins.push(pluginName as NodeType);
      }
    }
    
    return plugins;
  }
  
  private extractPluginName(packageName: string): string | null {
    const match = packageName.match(SimplePluginDiscovery.NODE_TYPE_PLUGIN_PATTERN);
    return match ? match[1] : null;
  }
}
```

### 2. 使用例

```typescript
// app/package.json での指定
{
  "dependencies": {
    "@hierarchidb/node-type-folder-plugin-plugin": "workspace:*",
    "@hierarchidb/node-type-basemap-plugin": "workspace:*",
    "@hierarchidb/node-type-shape-plugin-plugin": "workspace:*"
    // これらが自動的に検出される
  }
}
```

## プラグイン依存関係構造

### 1. 依存関係定義

各プラグインは自身の `package.json` で依存関係を宣言します：

```json
// stylemap-plugin-plugin/package.json
{
  "name": "@hierarchidb/node-type-stylemap-plugin-plugin",
  "dependencies": {
    "@hierarchidb/node-type-spreadsheet-plugin": "workspace:*"
  },
  "hierarchidb": {
    "plugin": {
      "nodeType": "stylemap-plugin",
      "extends": "spreadsheet-plugin",
      "dependencies": ["spreadsheet-plugin"],
      "category": "data-processing"
    }
  }
}
```

### 2. 依存関係解決アルゴリズム

```typescript
/**
 * トポロジカルソートによる依存関係解決
 */
resolveDependencies(plugins: PluginMetadata[]): NodeType[] {
  const graph = new Map<NodeType, Set<NodeType>>();
  const inDegree = new Map<NodeType, number>();
  
  // グラフ構築
  plugins.forEach(plugin => {
    if (!graph.has(plugin.nodeType)) {
      graph.set(plugin.nodeType, new Set());
      inDegree.set(plugin.nodeType, 0);
    }
    
    plugin.dependencies?.forEach(dep => {
      graph.get(dep)?.add(plugin.nodeType);
      inDegree.set(plugin.nodeType, (inDegree.get(plugin.nodeType) || 0) + 1);
    });
  });
  
  // トポロジカルソート
  const queue: NodeType[] = [];
  const result: NodeType[] = [];
  
  // 入次数0のノードをキューに追加
  inDegree.forEach((degree, nodeType) => {
    if (degree === 0) queue.push(nodeType);
  });
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    
    graph.get(current)?.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    });
  }
  
  // 循環依存チェック
  if (result.length !== plugins.length) {
    throw new Error('Circular dependency detected');
  }
  
  return result;
}
```

### 3. 循環依存検出

```typescript
/**
 * DFSによる循環依存検出
 */
detectCircularDependency(plugins: PluginMetadata[]): boolean {
  const WHITE = 0;  // 未訪問
  const GRAY = 1;   // 訪問中
  const BLACK = 2;  // 訪問済
  
  const colors = new Map<NodeType, number>();
  const graph = this.buildDependencyGraph(plugins);
  
  // 全ノードを未訪問に初期化
  plugins.forEach(p => colors.set(p.nodeType, WHITE));
  
  // DFSで循環を検出
  function dfs(node: NodeType): boolean {
    colors.set(node, GRAY);
    
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      const color = colors.get(neighbor) || WHITE;
      
      if (color === GRAY) {
        // バックエッジ発見（循環依存）
        return true;
      }
      
      if (color === WHITE && dfs(neighbor)) {
        return true;
      }
    }
    
    colors.set(node, BLACK);
    return false;
  }
  
  // 全ノードからDFS開始
  for (const plugin of plugins) {
    if (colors.get(plugin.nodeType) === WHITE) {
      if (dfs(plugin.nodeType)) {
        return true;
      }
    }
  }
  
  return false;
}
```

## プラグイン操作仕様

### 1. リセット操作

プラグインのリセット操作には3つのモードがあります：

#### Individual Mode（個別リセット）
```typescript
await pluginManagementAPI.resetPlugin({
  nodeType: 'shape',
  resetMode: 'individual',
  createBackup: true
});

// 動作:
// - GroupEntity: 削除 ✓
// - RelationalEntity: 削除 ✓  
// - TreeNode: 保持
// - PeerEntity: 保持
```

#### Folder Mode（完全リセット）
```typescript
await pluginManagementAPI.resetPlugin({
  nodeType: 'folder-plugin',
  resetMode: 'folder-plugin',
  createBackup: true
});

// 動作（folderプラグインのみ）:
// - GroupEntity: 削除 ✓
// - RelationalEntity: 削除 ✓
// - TreeNode: 削除 ✓
// - PeerEntity: 削除 ✓
```

#### System Mode（システムリセット）
```typescript
await pluginManagementAPI.resetSystem(true);

// 動作:
// - すべてのプラグインの全データを削除
// - システム全体を初期状態に戻す
```

### 2. 削除操作

```typescript
await pluginManagementAPI.deletePlugin('shape');

// 制約:
// - folderプラグインは削除不可（コアプラグイン）
// - 依存されているプラグインの削除時は警告表示
```

### 3. エンティティタイプの責務

| エンティティタイプ | 責務 | リセット対象 |
|---|---|---|
| TreeNode | ツリー構造のノード情報 | folderモードのみ |
| PeerEntity | ノード間の関係性 | folderモードのみ |
| GroupEntity | プラグイン固有のグループデータ | 常に削除 |
| RelationalEntity | プラグイン固有の関連データ | 常に削除 |

## API リファレンス

### PluginManagementAPI

```typescript
interface PluginManagementAPI {
  // 基本操作
  register(definition: PluginDefinition): Promise<PluginRegistrationResult>;
  unregister(nodeType: NodeType): Promise<UnregistrationResult>;
  validatePlugin(definition: PluginDefinition): Promise<PluginValidationResult>;
  
  // 監視・情報取得
  checkHealth(nodeType: NodeType): Promise<PluginHealthStatus>;
  listRegistered(options?: PluginListOptions): Promise<PluginRegistrationInfo[]>;
  getDependencies(nodeType: NodeType): Promise<PluginDependencyInfo>;
  
  // リセット・削除操作
  resetPlugin(options: PluginResetOptions): Promise<PluginResetResult>;
  deletePlugin(nodeType: NodeType): Promise<PluginDeleteResult>;
  resetSystem(createBackup?: boolean): Promise<PluginResetResult>;
  
  // バルク操作
  bulkOperation(options: BulkOperationOptions): Promise<BulkOperationResult>;
}
```

## UI実装例

### プラグイン管理画面

```tsx
function PluginManagementScreen() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [dependencies, setDependencies] = useState<Map<string, string[]>>();
  
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>プラグイン名</TableCell>
          <TableCell>依存関係</TableCell>
          <TableCell>操作</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {plugins.map(plugin => (
          <TableRow key={plugin.nodeType}>
            <TableCell>{plugin.name}</TableCell>
            <TableCell>
              {dependencies?.get(plugin.nodeType)?.join(', ') || 'なし'}
            </TableCell>
            <TableCell>
              <Button 
                onClick={() => handleReset(plugin.nodeType)}
                disabled={isProduction && !confirmationShown}
              >
                Reset
              </Button>
              <Button 
                onClick={() => handleDelete(plugin.nodeType)}
                disabled={plugin.nodeType === 'folder-plugin'}
              >
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### プロダクションモードの警告

```tsx
function ResetPluginDialog({ 
  pluginName, 
  isProduction, 
  onConfirm 
}: ResetDialogProps) {
  if (isProduction) {
    return (
      <Dialog>
        <DialogTitle>⚠️ 警告</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            本番環境でのリセット操作は危険です。
            データが完全に削除されます。
          </Alert>
          <Typography>
            プラグイン「{pluginName}」をリセットしますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>キャンセル</Button>
          <Button onClick={onConfirm} color="error">
            リセット実行
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
  // 開発環境用の簡易確認ダイアログ
}
```

## テスト

```bash
# ユニットテスト実行
pnpm test

# カバレッジ付きテスト
pnpm test:coverage

# 特定のテストのみ実行
pnpm test SimplePluginDiscovery
```

### テストケース例

```typescript
describe('SimplePluginDiscovery', () => {
  it('should discover plugins from package.json', () => {
    const packageJson = {
      dependencies: {
        '@hierarchidb/node-type-folder-plugin': '1.0.0',
        '@hierarchidb/node-type-shape-plugin': '1.0.0',
        'other-package': '1.0.0'
      }
    };
    
    const discovery = new SimplePluginDiscovery();
    const plugins = discovery.discoverPluginsFromPackageJson(packageJson);
    
    expect(plugins).toEqual(['folder-plugin', 'shape']);
  });
  
  it('should detect circular dependencies', () => {
    const plugins = [
      { nodeType: 'a', dependencies: ['b'] },
      { nodeType: 'b', dependencies: ['c'] },
      { nodeType: 'c', dependencies: ['a'] }
    ];
    
    const discovery = new SimplePluginDiscovery();
    const hasCircular = discovery.detectCircularDependency(plugins);
    
    expect(hasCircular).toBe(true);
  });
});
```

## 今後の拡張計画

### フェーズ1: 基本機能の安定化
- [ ] バックアップ機能の実装
- [ ] リストア機能の実装
- [ ] プラグインバージョニング

### フェーズ2: 高度な機能
- [ ] プラグインのホットリロード
- [ ] プラグインの自動更新
- [ ] プラグインマーケットプレイス対応

### フェーズ3: エンタープライズ機能
- [ ] プラグインのアクセス制御
- [ ] プラグインの監査ログ
- [ ] プラグインのパフォーマンス分析

## ライセンス

MIT License