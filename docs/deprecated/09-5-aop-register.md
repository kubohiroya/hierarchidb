## 9.5 統合プラグインアーキテクチャによる導入方法

### 9.5.1 プラグイン開発・パッケージング

**プラグイン構成**:
```
packages/plugins/{plugin-name}/
├── src/
│   ├── openstreetmap-type.ts              # プラグインエントリポイント
│   ├── types/                # エンティティ定義
│   │   └── {Plugin}Entity.ts
│   ├── handlers/             # EntityHandler実装
│   │   └── {Plugin}Handler.ts
│   ├── ui/                   # UIコンポーネント
│   │   ├── {Plugin}Dialog.tsx
│   │   ├── {Plugin}Panel.tsx
│   │   └── {Plugin}Form.tsx
│   └── definitions/          # UnifiedPluginDefinition
│       └── {Plugin}Definition.ts
├── package.json
└── tsconfig.json
```

### 9.5.2 プラグイン登録

**NodeTypeRegistryによる統合管理**: 統合プラグインレジストリ（NodeTypeRegistry）を基盤として、プラグインによる機能拡張を実現する。
**UnifiedPluginDefinition**: 従来のNodeTypeDefinitionにReact Routerルーティング機能とプラグインメタデータを統合した定義を使用。

**UnifiedPluginDefinition活用**: すべての拡張モジュールは、UnifiedPluginDefinitionを使用してNodeTypeRegistryに登録される。

```typescript
// 例: BaseMapプラグイン定義
export const BaseMapUnifiedDefinition: UnifiedPluginDefinition<BaseMapEntity, never, BaseMapWorkingCopy> = {
  // AOP機能（従来のNodeTypeDefinition）
  nodeType: 'basemap' as TreeNodeType,
  name: 'BaseMap',
  displayName: 'Base Map',
  database: { entityStore: 'basemaps', schema: {}, version: 1 },
  entityHandler: new BaseMapHandler(),
  lifecycle: { afterCreate, beforeDelete },
  
  // React Routerルーティング統合
  routing: {
    actions: {
      'view': { component: lazy(() => import('./MapView')), displayName: 'Map View' },
      'edit': { component: lazy(() => import('./MapEditor')), displayName: 'Map Editor' }
    },
    defaultAction: 'view'
  },
  
  // プラグインメタデータ
  meta: {
    version: '1.0.0',
    description: 'MapLibreGLJSで表示する基本的な地図を提供',
    tags: ['map', 'resources', 'visualization']
  }
};
```



**NodeTypeRegistryへの統合登録**:
```typescript
// アプリケーション初期化時
import { BaseMapPlugin } from '@hierarchidb/plugin-basemap';
import { ShapePlugin } from '@hierarchidb/plugin-shape_obsolate';

const registry = NodeTypeRegistry.getInstance();
const pluginLoader = new PluginLoader(pluginContext);

// 統合プラグインの読み込み
await pluginLoader.loadPlugin(BaseMapPlugin);
await pluginLoader.loadPlugin(ShapePlugin);
// ... 他のプラグイン
```

### 9.5.3 導入手順

1. **依存関係の追加**:
   ```bash
   pnpm add @hierarchidb/plugin-basemap @hierarchidb/plugin-shape_obsolate
   ```

2. **プラグイン設定（プライオリティ指定）**:
   ```typescript
   // src.config.ts
   export const pluginConfig = {
     basemap: { enabled: true, priority: 10, settings: { defaultStyle: 'streets' } },
     shape: { enabled: true, priority: 20, settings: { maxFileSize: '10MB' } },
     propertyresolver: { enabled: true, priority: 30 }, // shape_obsolate 等の後に初期化
     project: { enabled: true, priority: 40 } // 最後に初期化
   };
   ```

3. **アプリケーション統合**:
   ```typescript
   // main.ts
   import { initializePlugins } from './plugin/PluginInitializer';
   
   await initializePlugins(pluginConfig);
   ```

4. **データベーススキーマ統合**:
    - 各プラグインのデータベーススキーマが自動的に統合される
    - 初回起動時にDexieによるスキーママイグレーションが実行される

5. **ルーティング統合**:
    - React Routerの動的ルート生成により、プラグインのルーティングアクションが自動的に利用可能になる

6. **プラグイン初期化順序**:
    - プライオリティ値の昇順で初期化実行（10→20→30→40）
    - 依存関係のあるプラグイン（propertyresolver等）を後に配置

### 9.5.4 開発環境での統合

**モノレポ構成での開発**:
```bash
# プラグイン開発
cd packages/plugins/basemap
pnpm dev

# アプリケーションとの統合テスト
cd ../../..
pnpm build:plugins
pnpm dev
```

**型安全性の保証**:
- TypeScriptの型システムにより、プラグイン間の整合性を静的に検証
- UnifiedPluginDefinitionの型制約により、必要なインターフェースの実装を強制

### 9.5.5 プロダクション配布

**NPMパッケージとしての配布**:
```json
// package.json (プラグイン)
{
  "name": "@hierarchidb/plugin-basemap",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@hierarchidb/core": "^1.0.0",
    "react": "^18.0.0"
  }
}
```

**プラグインレジストリ（将来拡張）**:
- 公式/サードパーティプラグインのレジストリ
- バージョン管理とアップデート通知
- プラグイン間の依存関係解決

### 9.5.6 エラーハンドリング方針

#### 9.5.6.1 設定時エラー
- **対象**: プラグイン定義の型エラー、必須フィールド不備等
- **処理**: ビルドエラーとして標準エラー出力に詳細を出力
- **停止**: ビルドプロセスを停止し、修正を促す

#### 9.5.6.2 実行時エラー
- **対象**: ライフサイクルフック実行エラー、API呼び出しエラー等
- **処理**: console.errorでエラー内容をテキスト出力
- **継続**: 可能な限りアプリケーション実行を継続

#### 9.5.6.3 エラー例
```
// 設定時エラー例
TypeError: Plugin 'basemap' missing required field 'entityHandler'

// 実行時エラー例
console.error('Lifecycle hook afterCreate failed for basemap:', error);
```

### 9.5.7 統合プラグインレジストリ（NodeTypeRegistry）

#### 9.5.7.1 統合レジストリ実装

```typescript
// packages/core/src/registry/NodeTypeRegistry.ts

import type { LoaderFunction, ActionFunction } from 'react-router-dom';

// React Routerアクション定義
export interface PluginRouterAction {
  component: React.LazyExoticComponent<React.ComponentType>;
  loader?: LoaderFunction;
  action?: ActionFunction;
  displayName: string;
}

// 統合プラグイン定義（文書7基準 + React Router統合）
export interface UnifiedPluginDefinition<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy
> extends NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy> {
  // React Routerルーティング統合
  readonly routing: {
    actions: Record<string, PluginRouterAction>;
    defaultAction?: string;
  };
  
  // プラグインメタデータ
  readonly meta: {
    version: string;
    description?: string;
    author?: string;
    tags?: string[];
    dependencies?: string[];
  };
}

// 統合プラグインレジストリ
export class NodeTypeRegistry {
  private static instance: NodeTypeRegistry;
  private definitions: Map<TreeNodeType, UnifiedPluginDefinition> = new Map();
  private handlers: Map<TreeNodeType, EntityHandler> = new Map();
  private routingActions: Map<string, Map<string, PluginRouterAction>> = new Map(); // nodeType -> action -> config
  
  private constructor() {}
  
  static getInstance(): NodeTypeRegistry {
    if (!NodeTypeRegistry.instance) {
      NodeTypeRegistry.instance = new NodeTypeRegistry();
    }
    return NodeTypeRegistry.instance;
  }
  
  // 統合プラグイン登録（NodeTypeDefinition + Routing）
  registerPlugin<TEntity extends BaseEntity, TSubEntity extends BaseSubEntity, TWorkingCopy extends BaseWorkingCopy>(
    definition: UnifiedPluginDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    const { nodeType, entityHandler, routing } = definition;
    
    if (this.definitions.has(nodeType)) {
      throw new Error(`Node type ${nodeType} is already registered`);
    }
    
    // 統合プラグイン定義の保存
    this.definitions.set(nodeType, definition as UnifiedPluginDefinition);
    this.handlers.set(nodeType, entityHandler as EntityHandler);
    
    // React Routerアクションの登録
    if (routing?.actions) {
      const actionsMap = new Map<string, PluginRouterAction>();
      Object.entries(routing.actions).forEach(([actionName, config]) => {
        actionsMap.set(actionName, config);
      });
      this.routingActions.set(nodeType, actionsMap);
    }
    
    // データベーススキーマの登録
    this.registerDatabaseSchema(definition);
    
    // APIエクステンションの登録
    if (definition.api) {
      this.registerAPIExtensions(definition);
    }
  }

  // 従来のNodeTypeDefinition登録（後方互換性）
  register<TEntity extends BaseEntity, TSubEntity extends BaseSubEntity, TWorkingCopy extends BaseWorkingCopy>(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    // UnifiedPluginDefinitionに変換して登録
    const unifiedDefinition: UnifiedPluginDefinition<TEntity, TSubEntity, TWorkingCopy> = {
      ...definition,
      routing: {
        actions: {}, // ルーティングアクションなし
      },
      meta: {
        version: '1.0.0',
        description: definition.displayName || definition.name
      }
    };
    
    this.registerPlugin(unifiedDefinition);
  }
  
  unregister(nodeType: TreeNodeType): void {
    this.definitions.delete(nodeType);
    this.handlers.delete(nodeType);
    this.routingActions.delete(nodeType);
  }
  
  getDefinition(nodeType: TreeNodeType): UnifiedPluginDefinition | undefined {
    return this.definitions.get(nodeType);
  }
  
  getHandler(nodeType: TreeNodeType): EntityHandler | undefined {
    return this.handlers.get(nodeType);
  }
  
  getAllDefinitions(): UnifiedPluginDefinition[] {
    return Array.from(this.definitions.values());
  }
  
  // React Router統合メソッド
  getRouterAction(nodeType: TreeNodeType, action: string): PluginRouterAction | undefined {
    const actions = this.routingActions.get(nodeType);
    return actions?.get(action);
  }
  
  getAvailableActions(nodeType: TreeNodeType): string[] {
    const actions = this.routingActions.get(nodeType);
    return actions ? Array.from(actions.keys()) : [];
  }
  
  hasAction(nodeType: TreeNodeType, action: string): boolean {
    return this.routingActions.get(nodeType)?.has(action) ?? false;
  }
  
  // プラグイン検索・フィルタリング
  findPluginsByTag(tag: string): UnifiedPluginDefinition[] {
    return this.getAllDefinitions().filter(def => 
      def.meta?.tags?.includes(tag)
    );
  }
  
  getPluginDependencies(nodeType: TreeNodeType): string[] {
    const definition = this.getDefinition(nodeType);
    return definition?.meta?.dependencies ?? [];
  }
  
  private registerDatabaseSchema<TEntity extends BaseEntity, TSubEntity extends BaseSubEntity, TWorkingCopy extends BaseWorkingCopy>(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    // Dexieスキーマの動的登録
    const { database } = definition;
    // 実装詳細...
  }
  
  private registerAPIExtensions<TEntity extends BaseEntity, TSubEntity extends BaseSubEntity, TWorkingCopy extends BaseWorkingCopy>(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    // API拡張の登録
    const { api } = definition;
    // 実装詳細...
  }
}
```

