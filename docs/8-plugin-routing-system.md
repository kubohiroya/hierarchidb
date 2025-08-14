# 8. 階層的URLパターンでのプラグインルーティングシステム

## 8.1 概要

階層的URLパターン `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?` を維持したルーティングシステムを構築する。`treeNodeType` パラメータによるプラグインの動的ロード、file-convention based route config（@react-router/fs-routes）の活用、useLoaderDataによる階層情報とプラグインデータの統合を実現する。

## 8.2 URLパターン設計

### 8.2.1 基本パターン
```
/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?
```

- `treeId`: Tree識別子
- `pageTreeNodeId`: 現在表示中のノード（オプション）
- `targetTreeNodeId`: 操作対象のノード（オプション）  
- `treeNodeType`: プラグイン識別子として機能（basemap, shapes, locations等）
- `action`: プラグイン内のアクション（edit, preview, batch, settings等）

### 8.2.2 具体例
```
# 通常のツリー表示（プラグインなし）
/t/tree-123/node-456

# BasemapプラグインのEdit画面
/t/tree-123/node-456/node-789/basemap/edit

# ShapesプラグインのBatch処理
/t/tree-123/node-456/node-789/shapes/batch?step=2
```

### 8.2.3 ファイル構造

```
packages/app/src/routes/
├── t/
│   └── $treeId/
│       ├── _layout.tsx                     # ツリー共通レイアウト
│       ├── index.tsx                       # /t/:treeId
│       └── $pageTreeNodeId/
│           ├── index.tsx                   # /t/:treeId/:pageTreeNodeId
│           └── $targetTreeNodeId/
│               ├── index.tsx               # /t/:treeId/:pageTreeNodeId/:targetTreeNodeId
│               └── $treeNodeType/
│                   ├── _layout.tsx         # プラグインレイアウト
│                   └── $.tsx               # 動的アクションキャッチオール
```

```
packages/
├── plugins/
│   ├── basemap/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── routes/      # プラグイン固有のルート定義
│   │   │   │   ├── _index.tsx
│   │   │   │   └── settings.tsx
│   │   │   └── index.ts
│   │   └── plugin.config.ts # プラグイン設定
│   └── shapes/
│       ├── package.json
│       ├── src/
│       │   ├── routes/
│       │   │   ├── _index.tsx
│       │   │   ├── batch.tsx
│       │   │   └── preview.$id.tsx
│       │   └── index.ts
│       └── plugin.config.ts
└── tools/
    └── plugin-builder/     # プラグインビルドツール
        ├── generate-routes.ts
        ├── collect-plugins.ts
        └── templates/
```

## 8.3 データ仕様

### 8.3.1 RouteParams仕様

```typescript
interface RouteParams {
  treeId: string;              // Tree識別子
  pageTreeNodeId?: string;     // 現在表示中のノード
  targetTreeNodeId?: string;   // 操作対象のノード
  treeNodeType?: string;       // プラグイン識別子（basemap, shapes等）
  action?: string;             // プラグイン内アクション（edit, preview等）
}

interface QueryParams {
  step?: string;               // ウィザードステップ等
  [key: string]: string | undefined;
}
```

### 8.3.2 LoaderData仕様

```typescript
interface LoaderData {
  treeContext: {
    tree: Tree;
    currentNode: TreeNode | null;
    breadcrumbs: BreadcrumbItem[];
    expandedNodes: Set<TreeNodeId>;
  };
  targetNode: TreeNode | null;
  pluginData: unknown;  // プラグイン固有のデータ
}
```

### 8.3.3 統合プラグイン定義仕様（文書7基準）

```typescript
// 文書7のUnifiedPluginDefinitionを使用
interface UnifiedPluginDefinition<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy
> extends NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy> {
  // データベース管理（必須）
  readonly database: {
    entityStore: string;           // メインエンティティテーブル名
    subEntityStores?: string[];    // サブエンティティテーブル名
    schema: DatabaseSchema;        // Dexieスキーマ定義
    version: number;               // マイグレーション用バージョン
    indexes?: string[];            // 追加インデックス定義
  };
  
  // エンティティハンドラー（必須）
  readonly entityHandler: EntityHandler<TEntity, TSubEntity, TWorkingCopy>;
  
  // React Routerルーティング統合
  readonly routing: {
    actions: Record<string, {
      component: React.LazyExoticComponent<React.ComponentType>;
      loader?: LoaderFunction;
      action?: ActionFunction;
      displayName: string;
    }>;
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

// データベーススキーマ例
interface BasemapEntity extends BaseEntity {
  nodeId: TreeNodeId;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain';
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}
```

## 8.4 プラグイン統合実装

### 8.4.1 統合プラグインレジストリ（NodeTypeRegistry使用）

```typescript
// packages/app/src/plugins/registry.ts
import { NodeTypeRegistry } from '@hierarchidb/core';
import type { UnifiedPluginDefinition } from '@hierarchidb/core';

// 統合プラグインレジストリを使用
export const pluginRegistry = NodeTypeRegistry.getInstance();

// 統合プラグイン登録例（basemap）
const basemapPlugin: UnifiedPluginDefinition<BasemapEntity, never, BasemapWorkingCopy> = {
  // NodeTypeDefinition部分（文書7基準）
  nodeType: 'basemap' as TreeNodeType,
  name: 'BaseMap',
  displayName: 'Base Map',
  icon: 'map',
  color: '#4CAF50',
  
  // データベース管理
  database: {
    entityStore: 'basemaps',
    schema: {
      basemaps: '&nodeId, name, mapStyle, center, zoom, updatedAt',
      basemap_workingcopies: '&workingCopyId, workingCopyOf, copiedAt',
    },
    version: 1,
    indexes: ['mapStyle', 'updatedAt']
  },
  
  // エンティティハンドラー
  entityHandler: new BasemapHandler(),
  
  // ライフサイクルフック
  lifecycle: {
    afterCreate: async (nodeId, entity) => {
      console.log(`BaseMap created: ${nodeId}`, entity);
    },
    beforeDelete: async (nodeId) => {
      await cleanupBasemapResources(nodeId);
    }
  },
  
  // React Routerルーティング統合
  routing: {
    actions: {
      index: {
        component: lazy(() => import('@hierarchidb/plugin-basemap/view')),
        loader: basemapViewLoader,
        displayName: 'View Basemap'
      },
      edit: {
        component: lazy(() => import('@hierarchidb/plugin-basemap/edit')),
        loader: basemapEditLoader,
        action: basemapEditAction,
        displayName: 'Edit Basemap'
      },
      preview: {
        component: lazy(() => import('@hierarchidb/plugin-basemap/preview')),
        loader: basemapPreviewLoader,
        displayName: 'Preview Basemap'
      }
    },
    defaultAction: 'index'
  },
  
  // Worker API拡張
  api: {
    workerExtensions: {
      getMapPreview: async (nodeId: TreeNodeId) => {
        return await generateMapPreview(nodeId);
      },
      exportMapConfig: async (nodeId: TreeNodeId) => {
        return await exportBasemapConfiguration(nodeId);
      }
    }
  },
  
  // プラグインメタデータ
  meta: {
    version: '1.0.0',
    description: 'Basemap management and visualization',
    author: 'HierarchiDB Team',
    tags: ['map', 'basemap', 'geography'],
    dependencies: []
  }
};

// 統合プラグイン登録
pluginRegistry.registerPlugin(basemapPlugin);
```

### 8.4.2 動的ルートコンポーネント

```tsx
// packages/app/src/routes/t/$treeId/$pageTreeNodeId/$targetTreeNodeId/$treeNodeType/$.tsx
import { useParams, useLoaderData } from 'react-router-dom';
import { pluginRegistry } from '@/plugins/registry';
import { NotFound } from '@/components/NotFound';
import { Forbidden } from '@/components/Forbidden';
import { Suspense } from 'react';
import { Loading } from '@/components/Loading';

export const loader: LoaderFunction = async ({ params, request }) => {
  const { treeId, pageTreeNodeId, targetTreeNodeId, treeNodeType } = params;
  const action = params['*'] || 'index';  // キャッチオールパラメータ
  
  // 統合プラグインレジストリから取得
  const pluginDefinition = pluginRegistry.getDefinition(treeNodeType);
  if (!pluginDefinition) {
    throw new Response('Plugin not found', { status: 404 });
  }
  
  // ルーターアクション取得
  const routerAction = pluginRegistry.getRouterAction(treeNodeType, action);
  if (!routerAction) {
    throw new Response('Action not found', { status: 404 });
  }
  
  // ライフサイクルフック実行（beforeLoad）
  const lifecycleManager = new NodeLifecycleManager();
  if (targetTreeNodeId) {
    try {
      await lifecycleManager.executeLifecycleHook(
        'beforeUpdate', // データロード前のフック
        treeNodeType,
        targetTreeNodeId,
        { action, request: request.url }
      );
    } catch (error) {
      console.warn('Lifecycle hook failed:', error);
    }
  }
  
  // 階層情報を取得
  const treeContext = await loadTreeContext(treeId, pageTreeNodeId);
  const targetNode = await loadNode(targetTreeNodeId);
  
  // エンティティハンドラーを使用してデータ取得
  const entityHandler = pluginRegistry.getHandler(treeNodeType);
  let entityData = null;
  if (entityHandler && targetTreeNodeId) {
    try {
      entityData = await entityHandler.getEntity(targetTreeNodeId);
    } catch (error) {
      console.error('Entity load failed:', error);
    }
  }
  
  // プラグイン固有のローダーを実行
  const pluginData = routerAction.loader 
    ? await routerAction.loader({ params, request })
    : null;
  
  // 統合データ構造
  const loaderData = {
    treeContext,
    targetNode,
    entityData,        // エンティティハンドラーからのデータ
    pluginData,        // React Routerローダーからのデータ
    action,
    pluginDefinition   // プラグイン定義情報
  };
  
  // ライフサイクルフック実行（afterLoad）
  if (targetTreeNodeId && entityData) {
    try {
      await lifecycleManager.executeLifecycleHook(
        'afterUpdate', // データロード後のフック
        treeNodeType,
        targetTreeNodeId,
        entityData
      );
    } catch (error) {
      console.warn('Lifecycle hook failed:', error);
    }
  }
  
  return loaderData;
};

export default function PluginRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const { treeContext, targetNode, entityData, pluginData, action, pluginDefinition } = loaderData;
  const { treeNodeType } = useParams();
  
  // 統合プラグインレジストリから取得
  const routerAction = pluginRegistry.getRouterAction(treeNodeType!, action);
  const PluginComponent = routerAction?.component;
  
  if (!PluginComponent) {
    return <NotFound />;
  }
  
  // プラグインコンポーネント用のプロパティ
  const pluginProps = {
    // React Router データ
    treeContext,
    targetNode,
    pluginData,
    
    // エンティティハンドラーからのデータ
    entityData,
    
    // プラグイン定義情報
    pluginDefinition,
    
    // ライフサイクルフック実行関数
    executeLifecycleHook: async (hookName: string, ...args: any[]) => {
      const lifecycleManager = new NodeLifecycleManager();
      await lifecycleManager.executeLifecycleHook(hookName, treeNodeType!, ...args);
    },
    
    // エンティティ操作関数
    updateEntity: async (entityData: any) => {
      const entityHandler = pluginRegistry.getHandler(treeNodeType!);
      if (entityHandler && targetNode) {
        await entityHandler.updateEntity(targetNode.treeNodeId, entityData);
        
        // ライフサイクルフック実行
        const lifecycleManager = new NodeLifecycleManager();
        await lifecycleManager.executeLifecycleHook(
          'afterUpdate', 
          treeNodeType!, 
          targetNode.treeNodeId, 
          entityData
        );
      }
    }
  };
  
  return (
    <Suspense fallback={<Loading />}>
      <PluginComponent {...pluginProps} />
    </Suspense>
  );
}
```

### 8.4.3 プラグイン開発側の実装（Worker API拡張統合）

```typescript
// packages/plugins/basemap/src/index.ts
export { default as EditComponent } from './components/Edit';
export { default as PreviewComponent } from './components/Preview';
export { editLoader, previewLoader } from './loaders';
export { editAction, previewAction } from './actions';

// Worker API拡張エクスポート
export { BasemapWorkerExtensions } from './worker/extensions';
export type { BasemapEntity, BasemapWorkingCopy } from './types';

// packages/plugins/basemap/src/components/Edit.tsx
import type { BasemapEntity } from '../types';
import { useWorkerAPI } from '@hierarchidb/api';

interface BasemapEditProps {
  treeContext: any;
  targetNode: any;
  entityData: BasemapEntity;        // エンティティハンドラーからのデータ
  pluginData: any;                  // React Routerローダーからのデータ
  pluginDefinition: UnifiedPluginDefinition;
  executeLifecycleHook: (hookName: string, ...args: any[]) => Promise<void>;
  updateEntity: (data: Partial<BasemapEntity>) => Promise<void>;
}

export default function BasemapEdit({ 
  treeContext, 
  targetNode, 
  entityData, 
  pluginData,
  pluginDefinition,
  executeLifecycleHook,
  updateEntity 
}: BasemapEditProps) {
  const workerAPI = useWorkerAPI();
  
  // Worker API拡張メソッドの使用
  const handlePreviewGeneration = async () => {
    try {
      // beforeUpdate ライフサイクルフック実行
      await executeLifecycleHook('beforeUpdate', targetNode.treeNodeId, entityData);
      
      // Worker API拡張メソッド呼び出し
      const previewData = await workerAPI.invokeExtension(
        'basemap',
        'getMapPreview', 
        targetNode.treeNodeId
      );
      
      // afterUpdate ライフサイクルフック実行
      await executeLifecycleHook('afterUpdate', targetNode.treeNodeId, previewData);
      
      setPreviewUrl(previewData.url);
    } catch (error) {
      console.error('Preview generation failed:', error);
    }
  };
  
  const handleSave = async (updatedBasemap: Partial<BasemapEntity>) => {
    try {
      // エンティティ更新（ライフサイクルフック自動実行）
      await updateEntity(updatedBasemap);
      
      // Worker API拡張メソッドで設定エクスポート
      const exportData = await workerAPI.invokeExtension(
        'basemap',
        'exportMapConfig',
        targetNode.treeNodeId
      );
      
      console.log('Basemap saved and exported:', exportData);
    } catch (error) {
      console.error('Save failed:', error);
    }
  };
  
  return (
    <div>
      <Breadcrumbs items={treeContext.breadcrumbs} />
      <h1>Edit Basemap: {targetNode.name}</h1>
      
      {/* エンティティデータを使用したエディタ */}
      <BasemapEditor 
        entity={entityData}
        onSave={handleSave}
        onPreview={handlePreviewGeneration}
      />
      
      {/* プラグイン定義情報の表示 */}
      <PluginInfo 
        name={pluginDefinition.displayName}
        version={pluginDefinition.meta.version}
        description={pluginDefinition.meta.description}
      />
    </div>
  );
}

// packages/plugins/basemap/src/worker/extensions.ts
import type { WorkerAPIExtensions } from '@hierarchidb/core';
import type { BasemapEntity } from '../types';

export const BasemapWorkerExtensions: WorkerAPIExtensions = {
  // マッププレビュー生成
  getMapPreview: async (nodeId: TreeNodeId): Promise<{ url: string; thumbnail: string }> => {
    const entityHandler = new BasemapHandler();
    const entity = await entityHandler.getEntity(nodeId);
    
    if (!entity) {
      throw new Error(`Basemap entity not found: ${nodeId}`);
    }
    
    // MapLibreGL.jsを使用してプレビュー生成
    const previewUrl = await generateMapPreview(entity);
    const thumbnailUrl = await generateThumbnail(entity);
    
    return {
      url: previewUrl,
      thumbnail: thumbnailUrl
    };
  },
  
  // マップ設定エクスポート  
  exportMapConfig: async (nodeId: TreeNodeId): Promise<BasemapEntity> => {
    const entityHandler = new BasemapHandler();
    const entity = await entityHandler.getEntity(nodeId);
    
    if (!entity) {
      throw new Error(`Basemap entity not found: ${nodeId}`);
    }
    
    // 設定検証とサニタイゼーション
    const validatedEntity = await validateBasemapEntity(entity);
    
    return validatedEntity;
  },
  
  // バッチ処理（複数のBasemap操作）
  batchUpdateBasemaps: async (nodeIds: TreeNodeId[], updates: Partial<BasemapEntity>): Promise<void> => {
    const entityHandler = new BasemapHandler();
    
    for (const nodeId of nodeIds) {
      try {
        await entityHandler.updateEntity(nodeId, updates);
      } catch (error) {
        console.error(`Failed to update basemap ${nodeId}:`, error);
      }
    }
  }
};
```

## 8.5 ビルド時の自動登録

```typescript
// tools/plugin-builder/generate-registry.ts
import { glob } from 'glob';

export async function generatePluginRegistry() {
  const plugins = await glob('packages/plugins/*/package.json');
  
  let registryCode = `
    import { lazy } from 'react';
    import { pluginRegistry } from './registry';
  `;
  
  for (const pluginPath of plugins) {
    const packageJson = await readJson(pluginPath);
    const pluginName = packageJson.name.split('/').pop();
    const config = await import(`${pluginPath}/../plugin.config.ts`);
    
    registryCode += `
      // ${pluginName}
      pluginRegistry.set('${pluginName}', {
        nodeType: '${pluginName}',
        actions: {
          ${Object.entries(config.actions).map(([action, config]) => `
            '${action}': {
              component: lazy(() => import('@hierarchidb/plugin-${pluginName}/${action}')),
              loader: ${config.loader ? `require('@hierarchidb/plugin-${pluginName}').${action}Loader` : 'undefined'},
            }
          `).join(',')}
        }
      });
    `;
  }
  
  await writeFile('packages/app/src/plugins/registry.generated.ts', registryCode);
}
```

## 8.6 React Router統合

### 8.6.1 要件と設計方針

**React Router統合の具体的要件:**
- React Router v7 (React Router v7 Devが利用可能になり次第対応)
- file-convention based routing (@react-router/fs-routes) の活用
- 階層的URL構造の維持
- 動的プラグインルート生成
- useLoaderDataによるデータ統合
- TypeScript型安全性確保

**設計原則:**
1. **ファイルベース規則**: routes/構造がURL構造と直接対応
2. **プラグイン透過性**: プラグイン追加時のルート設定変更不要
3. **遅延ロード**: プラグインコンポーネントの動的インポート
4. **型安全性**: LoaderDataとuseLoaderDataの型推論

### 8.6.2 Vite設定

```typescript
// packages/app/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { routes } from '@react-router/fs-routes/vite';
import { generatePluginRegistry } from '../tools/plugin-builder/generate-registry';

export default defineConfig({
  plugins: [
    react(),
    routes({
      rootDirectory: 'src/routes',
      ignoredRouteFiles: ['**/.*', '**/*.d.ts']
    }),
    // プラグインレジストリ生成プラグイン
    {
      name: 'plugin-registry',
      buildStart: async () => {
        await generatePluginRegistry();
      }
    }
  ],
  resolve: {
    alias: {
      '@': '/src',
      '@plugins': '/src/plugins'
    }
  }
});
```

### 8.6.3 ルートファイル構造の詳細

```
packages/app/src/routes/
├── t/                                  # Tree routes base
│   ├── _layout.tsx                     # ツリー共通レイアウト
│   └── $treeId/                       # Dynamic tree ID
│       ├── _layout.tsx                 # Tree-specific layout
│       ├── index.tsx                   # /t/:treeId (tree root)
│       └── $pageTreeNodeId/           # Current page node
│           ├── index.tsx               # /t/:treeId/:pageTreeNodeId
│           └── $targetTreeNodeId/     # Target node for operations
│               ├── index.tsx           # /t/:treeId/:pageTreeNodeId/:targetTreeNodeId
│               └── $treeNodeType/     # Plugin type (basemap, shapes, etc)
│                   ├── _layout.tsx     # Plugin-specific layout
│                   ├── index.tsx       # Default plugin view
│                   └── $.tsx           # Catch-all for plugin actions
```

**各ルートファイルの役割:**

1. **$.tsx (キャッチオールルート)**:
   - 動的アクション (`edit`, `preview`, `batch`等) の処理
   - プラグインレジストリからコンポーネント解決
   - ローダーでのデータ統合

2. **_layout.tsx (レイアウトファイル)**:
   - 共通UI要素 (ブレッドクラム、サイドバー等)
   - 階層コンテキストの提供
   - エラーバウンダリ

3. **index.tsx (インデックスルート)**:
   - デフォルト表示
   - プラグインなしの通常ビュー

### 8.6.4 Loaderの統合設計

```typescript
// packages/app/src/routes/t/$treeId/$pageTreeNodeId/$targetTreeNodeId/$treeNodeType/$.tsx
import { LoaderFunctionArgs, useLoaderData, useParams } from 'react-router-dom';
import { HierarchicalPluginRouter } from '@hierarchidb/ui-routing';
import { WorkerAPI } from '@hierarchidb/api';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { treeId, pageTreeNodeId, targetTreeNodeId, treeNodeType } = params;
  const url = new URL(request.url);
  const action = params['*'] || 'index'; // キャッチオールパラメータ
  
  // URLから階層ルートパラメータを構築
  const routeParams = {
    treeId: treeId!,
    pageTreeNodeId,
    targetTreeNodeId, 
    treeNodeType,
    action
  };
  
  try {
    // HierarchicalPluginRouterを使用してデータを統合
    const pluginRouter = new HierarchicalPluginRouter();
    const hierarchicalData = await pluginRouter.loadHierarchicalData(routeParams);
    
    // WorkerAPIから実際のデータを取得
    const workerAPI = new WorkerAPI();
    const treeData = await workerAPI.getTreeContext(treeId!, pageTreeNodeId);
    const targetNodeData = targetTreeNodeId ? await workerAPI.getNode(targetTreeNodeId) : null;
    
    // プラグイン固有のローダーがあれば実行
    const plugin = pluginRouter.getPlugin(treeNodeType!);
    const pluginData = plugin?.actions[action]?.loader 
      ? await plugin.actions[action].loader!({ params, request })
      : null;
    
    return {
      treeContext: {
        ...hierarchicalData.treeContext,
        ...treeData  // 実際のデータで上書き
      },
      targetNode: targetNodeData || hierarchicalData.targetNode,
      pluginData,
      routeParams
    };
  } catch (error) {
    // エラーハンドリング - 404/500レスポンス
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Response('Not Found', { status: 404 });
    }
    throw new Response('Internal Server Error', { status: 500 });
  }
}

export default function PluginActionRoute() {
  const data = useLoaderData<typeof loader>();
  const { treeNodeType } = useParams();
  const action = useParams()['*'] || 'index';
  
  // プラグインコンポーネントを動的ロード
  const PluginComponent = useMemo(() => {
    return lazy(() => 
      import(`@hierarchidb/plugin-${treeNodeType}/${action}`)
        .catch(() => import(`@hierarchidb/plugin-${treeNodeType}/index`))
    );
  }, [treeNodeType, action]);
  
  return (
    React.createElement(Suspense, { fallback: 'Loading plugin...' },
      React.createElement(PluginComponent, data)
    )
  );
}
```

### 8.6.5 メインアプリケーション統合

```tsx
// packages/app/src/App.tsx
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@react-router/fs-routes';

const router = createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
```

## 8.7 自動プラグイン登録システム

### 8.7.1 要件と設計方針

**自動プラグイン登録の具体的要件:**
- ビルド時の `packages/plugins/*` 自動検出
- `plugin.config.ts` 設定ファイルの解析
- プラグインレジストリコード生成
- 型安全な動的インポート生成
- 開発時のホットリロード対応

**設計原則:**
1. **設定ファイル駆動**: plugin.config.tsが唯一の真実の源
2. **ビルド時生成**: ランタイムでの動的解析は避ける
3. **型安全性**: 生成コードもTypeScript型推論対象
4. **拡張性**: 新しいプラグイン追加時の設定変更不要

### 8.7.2 プラグイン設定ファイル仕様

```typescript
// packages/plugins/basemap/plugin.config.ts
export default {
  nodeType: 'basemap',
  displayName: 'Basemap Plugin',
  version: '1.0.0',
  actions: {
    index: {
      component: './src/components/BasemapView',
      loader: './src/loaders/basemapViewLoader',
      displayName: 'View Basemap'
    },
    edit: {
      component: './src/components/BasemapEdit', 
      loader: './src/loaders/basemapEditLoader',
      action: './src/actions/basemapEditAction',
      displayName: 'Edit Basemap'
    },
    settings: {
      component: './src/components/BasemapSettings',
      displayName: 'Basemap Settings'
    }
  },
  // プラグインメタデータ
  meta: {
    description: 'Basemap management plugin',
    author: 'HierarchiDB Team',
    tags: ['map', 'basemap', 'geography']
  }
} satisfies PluginConfig;

export interface PluginConfig {
  nodeType: string;
  displayName: string;
  version: string;
  actions: Record<string, {
    component: string;  // 相対パス
    loader?: string;    // 相対パス
    action?: string;    // 相対パス  
    displayName: string;
  }>;
  meta?: {
    description?: string;
    author?: string;
    tags?: string[];
  };
}
```

### 8.7.3 自動レジストリ生成ツール

```typescript
// tools/plugin-builder/generate-registry.ts
import { glob } from 'glob';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

interface PluginInfo {
  name: string;
  path: string;
  config: PluginConfig;
}

export async function generatePluginRegistry() {
  console.log('🔍 Scanning for plugins...');
  
  // packages/plugins/*/plugin.config.ts を検索
  const configFiles = await glob('packages/plugins/*/plugin.config.ts', {
    cwd: process.cwd()
  });
  
  const plugins: PluginInfo[] = [];
  
  for (const configFile of configFiles) {
    try {
      // プラグイン設定を動的インポート
      const fullPath = path.resolve(configFile);
      const config = (await import(fullPath)).default;
      const pluginName = path.dirname(configFile).split('/').pop()!;
      
      plugins.push({
        name: pluginName,
        path: path.dirname(configFile),
        config
      });
      
      console.log(`✅ Found plugin: ${pluginName}`);
    } catch (error) {
      console.warn(`⚠️  Failed to load plugin config: ${configFile}`, error);
    }
  }
  
  // レジストリコード生成
  const registryCode = generateRegistryCode(plugins);
  
  // 出力ファイルに書き込み
  const outputPath = 'packages/app/src/plugins/registry.generated.ts';
  await writeFile(outputPath, registryCode, 'utf-8');
  
  console.log(`📝 Generated plugin registry: ${outputPath}`);
  console.log(`📊 Registered ${plugins.length} plugins`);
}

function generateRegistryCode(plugins: PluginInfo[]): string {
  const imports = plugins.flatMap(plugin => 
    Object.keys(plugin.config.actions).map(action => {
      const actionConfig = plugin.config.actions[action];
      return `
// ${plugin.name} - ${action}
const ${plugin.name}_${action}_component = lazy(() => import('@hierarchidb/plugin-${plugin.name}/${action}'));
${actionConfig.loader ? `import { ${action}Loader } from '@hierarchidb/plugin-${plugin.name}';` : ''}
${actionConfig.action ? `import { ${action}Action } from '@hierarchidb/plugin-${plugin.name}';` : ''}`;
    })
  ).join('');
  
  const registrations = plugins.map(plugin => {
    const actions = Object.entries(plugin.config.actions)
      .map(([actionName, actionConfig]) => `
    '${actionName}': {
      component: ${plugin.name}_${actionName}_component,
      ${actionConfig.loader ? `loader: ${actionName}Loader,` : ''}
      ${actionConfig.action ? `action: ${actionName}Action,` : ''}
      displayName: '${actionConfig.displayName}'
    }`).join(',');
    
    return `
// Register ${plugin.name} plugin
PluginRegistry.register('${plugin.config.nodeType}', {
  nodeType: '${plugin.config.nodeType}',
  displayName: '${plugin.config.displayName}',
  version: '${plugin.config.version}',
  actions: {${actions}
  },
  meta: ${JSON.stringify(plugin.config.meta || {})}
});`;
  }).join('\n');
  
  return `/**
 * Auto-generated plugin registry
 * Generated at: ${new Date().toISOString()}
 * 
 * ⚠️ DO NOT EDIT MANUALLY - This file is auto-generated
 * ⚠️ Changes will be overwritten on next build
 */

import { lazy } from 'react';
import { PluginRegistry } from './registry';
${imports}

// Initialize plugins
export function initializePlugins() {
  console.log('🔧 Initializing plugins...');
  ${registrations}
  
  console.log(\`✅ Initialized \${PluginRegistry.list().length} plugins\`);
}

// Auto-initialize on module load
initializePlugins();
`;
}

// CLI コマンド
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generatePluginRegistry().catch(console.error);
}
```

### 8.7.4 開発環境での自動再生成

```typescript
// tools/plugin-builder/watch-plugins.ts
import chokidar from 'chokidar';
import { generatePluginRegistry } from './generate-registry.js';

export function watchPlugins() {
  console.log('👀 Watching for plugin changes...');
  
  const watcher = chokidar.watch('packages/plugins/*/plugin.config.ts', {
    ignored: /node_modules/,
    persistent: true
  });
  
  watcher
    .on('add', (path) => {
      console.log(`📁 Plugin config added: ${path}`);
      generatePluginRegistry();
    })
    .on('change', (path) => {
      console.log(`📝 Plugin config changed: ${path}`);
      generatePluginRegistry();
    })
    .on('unlink', (path) => {
      console.log(`🗑️  Plugin config removed: ${path}`);
      generatePluginRegistry();
    });
  
  return watcher;
}
```

## 8.8 実際のプラグインパッケージ構造

### 8.8.1 要件と設計方針

**プラグインパッケージの具体的要件:**
- 独立したnpmパッケージとして配布可能
- TypeScript型定義の提供
- プラグインAPI仕様への準拠
- 標準化されたディレクトリ構造
- テスタビリティ確保

**設計原則:**
1. **独立性**: メインアプリケーションに依存しない開発・テスト
2. **標準化**: 一貫したプラグイン構造
3. **再利用性**: 他のHierarchiDBインスタンスでも利用可能
4. **型安全性**: プラグインAPI使用時の型推論

### 8.8.2 標準プラグイン構造

```
packages/plugins/basemap/
├── package.json                    # パッケージ定義
├── plugin.config.ts               # プラグイン設定
├── tsconfig.json                   # TypeScript設定
├── vite.config.ts                 # ビルド設定
├── src/
│   ├── index.ts                   # エントリーポイント
│   ├── types.ts                   # プラグイン固有の型定義
│   ├── components/                # Reactコンポーネント
│   │   ├── BasemapView.tsx
│   │   ├── BasemapEdit.tsx
│   │   └── BasemapSettings.tsx
│   ├── loaders/                   # React Routerローダー
│   │   ├── basemapViewLoader.ts
│   │   └── basemapEditLoader.ts
│   ├── actions/                   # React Routerアクション
│   │   └── basemapEditAction.ts
│   ├── services/                  # ビジネスロジック
│   │   └── BasemapService.ts
│   └── utils/                     # ユーティリティ
│       └── basemapUtils.ts
├── tests/                         # テストファイル
│   ├── components/
│   ├── loaders/
│   └── services/
└── docs/                          # プラグインドキュメント
    ├── README.md
    └── API.md
```

### 8.8.3 プラグインパッケージの実装例

```json
// packages/plugins/basemap/package.json
{
  "name": "@hierarchidb/plugin-basemap",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./index": "./dist/components/BasemapView.js",
    "./edit": "./dist/components/BasemapEdit.js",
    "./settings": "./dist/components/BasemapSettings.js"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-router-dom": "^6.0.0"
  },
  "peerDependencies": {
    "@hierarchidb/api": "*",
    "@hierarchidb/ui-core": "*"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

```typescript
// packages/plugins/basemap/src/index.ts
export { default as BasemapView } from './components/BasemapView';
export { default as BasemapEdit } from './components/BasemapEdit';
export { default as BasemapSettings } from './components/BasemapSettings';

export { basemapViewLoader } from './loaders/basemapViewLoader';
export { basemapEditLoader } from './loaders/basemapEditLoader';

export { basemapEditAction } from './actions/basemapEditAction';

export type * from './types';

// プラグインメタデータ
export const PLUGIN_METADATA = {
  name: 'basemap',
  version: '1.0.0',
  displayName: 'Basemap Plugin',
  description: 'Basemap management and visualization'
} as const;
```

```typescript
// packages/plugins/basemap/src/components/BasemapEdit.tsx
import React from 'react';
import { useLoaderData } from 'react-router-dom';
import type { HierarchicalRouteData } from '@hierarchidb/ui-routing';
import type { BasemapEntity } from '../types';

interface BasemapEditProps extends HierarchicalRouteData {
  pluginData: {
    basemap: BasemapEntity;
    editMode: boolean;
  };
}

export default function BasemapEdit() {
  const data = useLoaderData() as BasemapEditProps;
  const { treeContext, targetNode, pluginData } = data;
  const { basemap, editMode } = pluginData;
  
  return (
    <div className="basemap-edit">
      <header>
        <h1>Edit Basemap: {targetNode.name}</h1>
        <nav>
          {treeContext.breadcrumbs.map((crumb, i) => (
            <span key={i}>
              {crumb.name} {i < treeContext.breadcrumbs.length - 1 && ' > '}
            </span>
          ))}
        </nav>
      </header>
      
      <main>
        <BasemapEditor 
          basemap={basemap}
          readOnly={!editMode}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </main>
    </div>
  );
  
  function handleSave(updatedBasemap: BasemapEntity) {
    // React Router actionを通じてデータを更新
    submit(updatedBasemap, { method: 'POST' });
  }
  
  function handleCancel() {
    navigate(`/t/${treeContext.tree.id}/${targetNode.id}`);
  }
}
```

### 8.8.4 プラグイン開発ワークフロー

```bash
# 新しいプラグインを作成
npm run create-plugin shapes

# プラグイン開発
cd packages/plugins/shapes
npm run dev  # ウォッチモードでビルド

# テスト実行
npm test

# 本体アプリケーションで確認
cd ../../../
npm run dev  # プラグイン自動検出・登録
```

## 8.9 制約条件と要件

### 8.9.1 パフォーマンス要件

- プラグインコンポーネントの遅延ロード（Code Splitting）
- ルート解決時間 < 100ms
- 初回ロード時間 < 3秒

### 8.9.2 互換性要件
- React Router v7対応
- 既存のeria-cartograph URLパターンとの互換性維持
- ブラウザの戻る/進むボタンの自然な動作

### 8.9.3 アーキテクチャ制約
- file-convention based routing（@react-router/fs-routes）の使用
- Viteビルドシステムとの統合
- TypeScript型安全性の確保
```

## 8.10 想定される使用例

### 8.10.1 基本的な使用パターン
```
// BasemapプラグインのEdit画面
/t/tree-123/node-456/node-789/basemap/edit

// Shapesプラグインのバッチ処理
/t/tree-123/node-456/node-789/shapes/batch?step=2

// プラグインなし（通常のツリー表示）
/t/tree-123/node-456
```

### 8.10.2 エッジケース
- 存在しないプラグインタイプへのアクセス → 404表示
- 無効なアクションへのアクセス → 404表示
- 無効なtreeId/nodeId → エラーバウンダリで処理

### 8.10.3 データフロー
1. ブラウザがURLにアクセス
2. React Routerがパラメータを抽出
3. Loaderが階層情報を取得
4. プラグイン固有のデータをロード
5. コンポーネントをレンダリング

## 8.11 受け入れ基準

- [ ] 階層的URLパターンが正しく動作する
- [ ] プラグインが動的にロードされる
- [ ] useLoaderDataで階層情報が取得できる
- [ ] ブラウザの履歴が正しく動作する
- [ ] TypeScript型が正しく推論される
- [ ] 存在しないルートで404が表示される
- [ ] プラグインの自動登録が動作する

## 8.12 利点

1. **URL互換性**: 既存のeria-cartographパターンを維持
2. **プラグイン拡張性**: 新しいプラグインの追加が容易
3. **型安全性**: TypeScriptによる型推論
4. **遅延ロード**: プラグインコンポーネントの動的インポート
5. **自動登録**: ビルド時のプラグイン自動検出と登録

## 8.13 移行パス

1. 既存のURLパターンは変更なし
2. プラグインは`treeNodeType`として認識
3. 段階的にプラグインを追加可能