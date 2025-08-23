## 9.4 階層的URLパターンでのプラグインルーティングシステム

### 9.4.0 概略：NodeTypeRegistry と UI ルーティング統合

7章（NodeTypeRegistry）では、`UnifiedPluginDefinition` に `routing` を持たせ、`nodeType` ごとのアクションを登録可能としている。

アプリ側のルートは、`treeNodeType` と `action` を元に Registry から該当 `PluginRouterAction` を取得してレンダリングする方針（8章の設計）。現状の `t.*.($treeNodeType).tsx` / `($action).tsx` は、その枠組みのプレースホルダとして Loader Data を確認・デバッグ出力している。


### 9.4.0.1 概略：典型的なプラグインUIの実装例

以下は疑似コード（6章の Basemap 例に準拠）。

```tsx
// packages/plugins/basemap/src/ui/MapEditor.tsx
export default function MapEditor() {
  const data = useRouteLoaderData(/* 上位loaderのid */) as LoaderData;
  const nodeId = data.targetNode?.treeNodeId ?? data.treeContext.currentNode?.treeNodeId;
  // ここで WorkerAPI による entity 取得や保存を行う
  return <MapEditorView nodeId={nodeId} />;
}
```

```ts
// packages/plugins/basemap/src/definitions/BaseMapDefinition.ts
export const BaseMapUnifiedDefinition: UnifiedPluginDefinition = {
  // ... NodeTypeDefinition 部分（DB, handler, lifecycle等）
  routing: {
    actions: {
      view: { component: lazy(() => import('../ui/MapView')), displayName: 'Map View' },
      edit: { component: lazy(() => import('../ui/MapEditor')), displayName: 'Map Editor' },
    },
    defaultAction: 'view'
  },
};
```

アプリは `treeNodeType='basemap'` かつ `action='edit'` のとき、Registry 経由で `MapEditor` をレンダリングする。

---

### 9.4.1 統合プラグイン定義仕様

ここでは、BaseMapEntityを例に統合プラグイン定義仕様を示す。

```typescript
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

以下、NodeTypeDefinitionの定義内容については、前章を参照すること。

```typescript
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
```

### 9.4.2 プラグイン統合実装

#### 9.4.2.1 統合プラグインレジストリ（NodeTypeRegistry使用）

```typescript
// packages/src/src/plugins/registry.ts
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
        displayName: 'PreviewStep Basemap'
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

#### 9.4.2.2 動的ルートコンポーネント

```tsx
// packages/src/src/routes/t/$treeId/$pageTreeNodeId/$targetTreeNodeId/$treeNodeType/$.tsx
import { useParams, useLoaderData } from 'react-router-dom';
import { pluginRegistry } from '@/plugins/registry';
import { NotFound } from '@/containers/NotFound';
import { Forbidden } from '@/containers/Forbidden';
import { Suspense } from 'react';
import { Loading } from '@/containers/Loading';

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

#### 9.4.2.3 プラグイン開発側の実装（Worker API拡張統合）

```tsx
// packages/plugins/basemap/src/openstreetmap-type.ts
export { default as EditComponent } from './containers/Edit';
export { default as PreviewComponent } from './containers/PreviewStep';
export { editLoader, previewLoader } from './loaders';
export { editAction, previewAction } from './actions';

// Worker API拡張エクスポート
export { BasemapWorkerExtensions } from './worker/extensions';
export type { BasemapEntity, BasemapWorkingCopy } from './types';

// packages/plugins/basemap/src/containers/Edit.tsx
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

#### 9.4.2.4 ビルド時の自動登録

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
  
  await writeFile('packages/src/src/plugins/registry.output.ts', registryCode);
}
```

### 9.4.3 React Router統合

#### 9.4.3.1 要件と設計方針

【内部仕様変更の要点】
- React Router v7 の app/routes ベース（フラットファイル命名）に移行
- 各階層に clientLoader を配置し、段階的にデータを組み立てる
- 階層的URL構造は維持（外部仕様変更なし）
- 動的プラグインルート（treeNodeType/action）のレンダリングは最深層で行う前提
- useLoaderData/useRouteLoaderData による型安全なデータ取得

【設計原則】
1. ファイル命名がURL構造と1対1で対応（t.($treeId).($pageTreeNodeId)...）
2. 各階層で必要最小限のデータのみ取得して合成（ステップロード）
3. プラグイン追加時にルーター設定を手で編集しない（ルートは固定・中身で分岐）
4. 型安全性（Loaderの戻り値に基づく推論）

#### 9.4.3.2 ルートエントリ（root.tsx）

```tsx
// packages/src/src/root.tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router-dom';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
```

#### 9.4.3.3 ルートファイル構造の詳細

- app/routes 配下のフラットファイル命名で階層を表現
- 各ファイルは clientLoader とコンポーネントを持ち、`useLoaderData` で階層データを段階的に参照

```
packages/app/app/routes/
├── t._index.tsx
├── t.($treeId).tsx
├── t.($treeId)._layout.tsx
├── t.($treeId).($pageTreeNodeId).tsx
├── t.($treeId).($pageTreeNodeId)._layout.tsx
├── t.($treeId).($pageTreeNodeId).($targetTreeNodeId).tsx
├── t.($treeId).($pageTreeNodeId).($targetTreeNodeId)._layout.tsx
├── t.($treeId).($pageTreeNodeId).($targetTreeNodeId).( $treeNodeType ).tsx
└── t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).($action).tsx
```

役割:
- _layout.tsx: 各階層の共通UI/サブアウトレット
- 最終ファイル（…($treeNodeType).($action).tsx）: プラグインのアクションを表示（内部で動的読み込み）

#### 9.4.3.4 Loaderの統合設計

現在は各階層で clientLoader を用いてデータを段階的に取得し、`~/loader` のユーティリティで共通化している。

```tsx
// packages/src/src/routes/t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).($action).tsx
import { Outlet, useLoaderData } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTreeNodeAction, LoadTreeNodeActionArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTreeNodeAction(args.params as LoadTreeNodeActionArgs);
}

export default function TLayout() {
  const data = useLoaderData();
  if (!data.action) return null;
  return (
    <div>
      {/* ここにプラグインの実描画（treeNodeType/actionに応じた動的レンダリング）を行う */}
      <Outlet />
    </div>
  );
}
```

共通ローダー群（抜粋）:

```ts
// packages/src/src/loader.ts
import { WorkerAPIClient } from '@hierarchidb/registry';

export async function loadWorkerAPIClient() {
  return { client: await WorkerAPIClient.getSingleton() };
}

export async function loadTree({ treeId }: { treeId: string }) {
  const { client } = await loadWorkerAPIClient();
  return {
    client,
    tree: await client.getAPI().getTree({ treeId }),
  };
}

export async function loadPageTreeNode({ treeId, pageTreeNodeId }: { treeId: string; pageTreeNodeId: string; }) {
  const base = await loadTree({ treeId });
  return {
    ...base,
    pageTreeNode: await base.client.getAPI().getNode({ treeNodeId: pageTreeNodeId || treeId + 'Root' }),
  };
}

// ... loadTargetTreeNode → loadTreeNodeType → loadTreeNodeAction と段階的に合成していく
```

補足（階層データの参照ヘルパー）:

```ts
// packages/src/src/loader.ts（抜粋）
import { useRouteLoaderData } from 'react-router';

export function useTree() {
  return useRouteLoaderData('t/($treeId)');
}
export function usePageTreeNode() {
  return useRouteLoaderData('t/($treeId)/($pageTreeNodeId)');
}
export function useTargetTreeNode() {
  return useRouteLoaderData('t/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)');
}
export function useTreeNodeType() {
  return useRouteLoaderData('t/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)/($treeNodeType)');
}
export function useTreeNodeTAction() {
  return useRouteLoaderData('t/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)/($treeNodeType)/($action)');
}
```

#### 9.4.3.5 メインアプリケーション統合

- ルーターの明示的生成は不要。app/routes のファイルから自動的にルートが構築される。
- ルートエントリは root.tsx（上記 8.6.2）で Layout と Outlet を提供する。
- 各ルートモジュールで `export async function clientLoader()` を定義し、`useLoaderData` で参照する。

#### 9.4.4 自動プラグイン登録システム

##### 9.4.4.1 要件と設計方針

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

#### 9.4.4.2 プラグイン設定ファイル仕様

```typescript
// packages/plugins/basemap/plugin.config.ts
export default {
  nodeType: 'basemap',
  displayName: 'Basemap Plugin',
  version: '1.0.0',
  actions: {
    index: {
      component: './src/containers/BasemapView',
      loader: './src/loaders/basemapViewLoader',
      displayName: 'View Basemap'
    },
    edit: {
      component: './src/containers/BasemapEdit', 
      loader: './src/loaders/basemapEditLoader',
      action: './src/actions/basemapEditAction',
      displayName: 'Edit Basemap'
    },
    settings: {
      component: './src/containers/BasemapSettings',
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

#### 9.4.4.3 自動レジストリ生成ツール

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
  const outputPath = 'packages/src/src/plugins/registry.output.ts';
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

#### 9.4.4.4 開発環境での自動再生成

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

## 9.4.5 実際のプラグインパッケージ構造

### 9.4.5.1 要件と設計方針

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

### 9.4.5.2 標準プラグイン構造

```
packages/plugins/basemap/
├── package.json                    # パッケージ定義
├── plugin.config.ts               # プラグイン設定
├── tsconfig.json                   # TypeScript設定
├── vite.config.ts                 # ビルド設定
├── src/
│   ├── openstreetmap-type.ts                   # エントリーポイント
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

### 9.4.5.3 プラグインパッケージの実装例

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
    "./index": "./dist/containers/BasemapView.js",
    "./edit": "./dist/containers/BasemapEdit.js",
    "./settings": "./dist/containers/BasemapSettings.js"
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
// packages/plugins/basemap/src/openstreetmap-type.ts
export { default as BasemapView } from './containers/BasemapView';
export { default as BasemapEdit } from './containers/BasemapEdit';
export { default as BasemapSettings } from './containers/BasemapSettings';

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

```tsx
// packages/plugins/basemap/src/containers/BasemapEdit.tsx
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

#### 9.4.5.4 プラグイン開発ワークフロー

```bash
# 新しいプラグインを作成
npm run create-plugin shape_obsolate

# プラグイン開発
cd packages/plugins/shape_obsolate
npm run dev  # ウォッチモードでビルド

# テスト実行
npm test

# 本体アプリケーションで確認
cd ../../../
npm run dev  # プラグイン自動検出・登録
```

### 9.4.6 制約条件と要件

#### 9.4.6.1 パフォーマンス要件

- プラグインコンポーネントの遅延ロード（Code Splitting）
- ルート解決時間 < 100ms
- 初回ロード時間 < 3秒

#### 9.4.6.2 互換性要件
- React Router v7対応
- 既存のeria-cartograph URLパターンとの互換性維持
- ブラウザの戻る/進むボタンの自然な動作

#### 9.4.6.3 アーキテクチャ制約
- file-convention based routing（@react-router/fs-routes）の使用
- Viteビルドシステムとの統合
- TypeScript型安全性の確保


### 9.4.7 ライフサイクルマネージャー

```typescript
// packages/worker/src/lifecycle/NodeLifecycleManager.ts

export class NodeLifecycleManager {
  private registry: NodeTypeRegistry;
  
  constructor() {
    this.registry = NodeTypeRegistry.getInstance();
  }
  
  async executeLifecycleHook<
    TEntity extends BaseEntity = BaseEntity,
    TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
    THookName extends keyof NodeLifecycleHooks<TEntity, TWorkingCopy> = keyof NodeLifecycleHooks<TEntity, TWorkingCopy>
  >(
    hookName: THookName,
    nodeType: TreeNodeType,
    ...args: Parameters<NonNullable<NodeLifecycleHooks<TEntity, TWorkingCopy>[THookName]>>
  ): Promise<void> {
    const definition = this.registry.getDefinition(nodeType);
    if (!definition?.lifecycle) return;
    
    const hook = definition.lifecycle[hookName as keyof NodeLifecycleHooks];
    if (hook && typeof hook === 'function') {
      try {
        // @ts-expect-error - 動的な引数の型チェックは実行時に行う
        await hook(...args);
      } catch (error) {
        console.error(`Lifecycle hook ${hookName} failed for ${nodeType}:`, error);
        throw error;
      }
    }
  }
  
  async handleNodeCreation(
    parentId: TreeNodeId,
    nodeData: Partial<TreeNode>,
    nodeType: TreeNodeType
  ): Promise<TreeNodeId> {
    // Before hook
    await this.executeLifecycleHook('beforeCreate', nodeType, parentId, nodeData);
    
    // コア処理（ノード作成）
    const nodeId = await this.createNodeCore(parentId, nodeData);
    
    // エンティティ作成
    const handler = this.registry.getHandler(nodeType);
    if (handler) {
      const entity = await handler.createEntity(nodeId, nodeData.data);
      
      // After hook
      await this.executeLifecycleHook('afterCreate', nodeType, nodeId, entity);
    }
    
    return nodeId;
  }
  
  async handleNodeUpdate(
    nodeId: TreeNodeId,
    changes: Partial<TreeNode>,
    nodeType: TreeNodeType
  ): Promise<void> {
    // Before hook
    await this.executeLifecycleHook('beforeUpdate', nodeType, nodeId, changes);
    
    // コア処理（ノード更新）
    await this.updateNodeCore(nodeId, changes);
    
    // エンティティ更新
    const handler = this.registry.getHandler(nodeType);
    if (handler && changes.data) {
      await handler.updateEntity(nodeId, changes.data);
      const entity = await handler.getEntity(nodeId);
      
      // After hook
      await this.executeLifecycleHook('afterUpdate', nodeType, nodeId, entity);
    }
  }
  
  async handleNodeDeletion(
    nodeId: TreeNodeId,
    nodeType: TreeNodeType
  ): Promise<void> {
    // Before hook
    await this.executeLifecycleHook('beforeDelete', nodeType, nodeId);
    
    // エンティティ削除
    const handler = this.registry.getHandler(nodeType);
    if (handler) {
      await handler.deleteEntity(nodeId);
    }
    
    // コア処理（ノード削除）
    await this.deleteNodeCore(nodeId);
    
    // After hook
    await this.executeLifecycleHook('afterDelete', nodeType, nodeId);
  }
  
  private async createNodeCore(
    parentId: TreeNodeId,
    nodeData: Partial<TreeNode>
  ): Promise<TreeNodeId> {
    // 実装詳細...
    return generateUUID();
  }
  
  private async updateNodeCore(
    nodeId: TreeNodeId,
    changes: Partial<TreeNode>
  ): Promise<void> {
    // 実装詳細...
  }
  
  private async deleteNodeCore(nodeId: TreeNodeId): Promise<void> {
    // 実装詳細...
  }
}
```

### 9.4.8 プラグインアーキテクチャ

#### 9.4.8.1 プラグインインターフェース

```typescript
// packages/core/src/plugin/Plugin.ts

// プラグイン設定の型
export interface PluginConfig {
  enabled: boolean;
  settings?: Record<string, string | number | boolean>;
}

// プラグインの型定義（Genericsで拡張可能）
export interface Plugin<TContext extends PluginContext = PluginContext> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  
  // ノードタイプ定義（型安全）
  readonly nodeTypes?: Array<NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>>;
  
  // 初期化（コンテキストの型を指定可能）
  initialize?(context: TContext): Promise<void>;
  
  // クリーンアップ
  cleanup?(): Promise<void>;
  
  // 依存関係
  readonly dependencies?: string[];
  
  // 設定スキーマ
  readonly configSchema?: Record<string, 'string' | 'number' | 'boolean'>;
}

// プラグインコンテキストの基本型
export interface PluginContext {
  registry: NodeTypeRegistry;
  dbConnection: Dexie;
  apiRegistry: WorkerAPIRegistry;
  uiRegistry: UIComponentRegistry;
}

// プラグイン拡張の型定義
export interface PluginExtension {
  name: string;
  version: string;
  instance: object;
}

// 拡張可能なプラグインコンテキスト
export interface ExtendedPluginContext<T extends Record<string, PluginExtension> = {}> 
  extends PluginContext {
  extensions: T;
}
```

#### 9.4.8.2 プラグインローダー

```typescript
// packages/src/src/plugin/PluginLoader.ts

export class PluginLoader<TContext extends PluginContext = PluginContext> {
  private plugins: Map<string, Plugin<TContext>> = new Map();
  private context: TContext;
  
  constructor(context: TContext) {
    this.context = context;
  }
  
  async loadPlugin<TPluginContext extends TContext>(
    plugin: Plugin<TPluginContext>
  ): Promise<void> {
    // 依存関係チェック
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.plugins.has(depId)) {
          throw new Error(`Missing dependency: ${depId}`);
        }
      }
    }
    
    // プラグイン初期化（型安全）
    if (plugin.initialize) {
      await plugin.initialize(this.context as TPluginContext);
    }
    
    // ノードタイプ登録（型安全）
    if (plugin.nodeTypes) {
      for (const nodeType of plugin.nodeTypes) {
        this.context.registry.register(nodeType);
      }
    }
    
    this.plugins.set(plugin.id, plugin as Plugin<TContext>);
  }
  
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    // ノードタイプ登録解除
    if (plugin.nodeTypes) {
      for (const nodeType of plugin.nodeTypes) {
        this.context.registry.unregister(nodeType.nodeType);
      }
    }
    
    // クリーンアップ
    if (plugin.cleanup) {
      await plugin.cleanup();
    }
    
    this.plugins.delete(pluginId);
  }
  
  getPlugin<TPluginContext extends TContext = TContext>(
    pluginId: string
  ): Plugin<TPluginContext> | undefined {
    return this.plugins.get(pluginId) as Plugin<TPluginContext> | undefined;
  }
  
  getAllPlugins(): Plugin<TContext>[] {
    return Array.from(this.plugins.values());
  }
}
```


### 9.4.9 Worker API拡張

#### 9.4.9.1 API拡張インターフェース

```typescript
// packages/api/src/extensions/WorkerAPIExtension.ts

// Worker API拡張の型定義
export interface WorkerAPIExtension<
  TMethods extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>
> {
  readonly nodeType: TreeNodeType;
  readonly methods: TMethods;
}

// 型安全なメソッド呼び出し結果
export type InvokeResult<
  T extends WorkerAPIExtension,
  M extends keyof T['methods']
> = T['methods'][M] extends (...args: APIMethodArgs) => Promise<infer R> 
  ? R extends APIMethodReturn 
    ? R 
    : never 
  : never;

export class WorkerAPIRegistry {
  private extensions: Map<TreeNodeType, WorkerAPIExtension<Record<string, WorkerAPIMethod>>> = new Map();
  
  register<T extends Record<string, WorkerAPIMethod>>(
    extension: WorkerAPIExtension<T>
  ): void {
    this.extensions.set(extension.nodeType, extension);
  }
  
  getExtension<T extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>>(
    nodeType: TreeNodeType
  ): WorkerAPIExtension<T> | undefined {
    return this.extensions.get(nodeType) as WorkerAPIExtension<T> | undefined;
  }
  
  async invokeMethod<
    TMethods extends Record<string, WorkerAPIMethod>,
    TMethod extends keyof TMethods,
    TArgs extends Parameters<TMethods[TMethod]>,
    TReturn extends ReturnType<TMethods[TMethod]>
  >(
    nodeType: TreeNodeType,
    methodName: TMethod,
    ...args: TArgs
  ): Promise<TReturn> {
    const extension = this.getExtension<TMethods>(nodeType);
    if (!extension || !extension.methods[methodName]) {
      throw new Error(`Method ${String(methodName)} not found for ${nodeType}`);
    }
    
    return await extension.methods[methodName](...args) as TReturn;
  }
}
```

#### 9.4.9.2 拡張APIの統合

```typescript
// packages/worker/src/services/ExtendedTreeMutationService.ts

interface CommitWorkingCopyPayload {
  workingCopyId: UUID;
  nodeType?: TreeNodeType;
  onNameConflict?: 'error' | 'auto-rename';
}

export class ExtendedTreeMutationService extends TreeMutationServiceImpl {
  private lifecycleManager: NodeLifecycleManager;
  private apiRegistry: WorkerAPIRegistry;
  
  constructor() {
    super();
    this.lifecycleManager = new NodeLifecycleManager();
    this.apiRegistry = new WorkerAPIRegistry();
  }
  
  async commitWorkingCopyForCreate(
    cmd: CommandEnvelope<'commitWorkingCopyForCreate', CommitWorkingCopyPayload>
  ): Promise<{ seq: Seq; nodeId: TreeNodeId }> {
    const { workingCopyId, nodeType } = cmd.payload;
    
    // ノードタイプ取得
    const node = await this.getWorkingCopyNode(workingCopyId);
    const actualNodeType = nodeType || node.treeNodeType;
    
    // ライフサイクル処理を含む作成
    const nodeId = await this.lifecycleManager.handleNodeCreation(
      node.parentTreeNodeId,
      node,
      actualNodeType
    );
    
    return { seq: this.getNextSeq(), nodeId };
  }
  
  // 拡張メソッドの呼び出し（型安全）
  async invokeExtension<
    TMethods extends Record<string, WorkerAPIMethod>,
    TMethod extends keyof TMethods
  >(
    nodeType: TreeNodeType,
    method: TMethod,
    ...args: Parameters<TMethods[TMethod]>
  ): Promise<ReturnType<TMethods[TMethod]>> {
    return await this.apiRegistry.invokeMethod<TMethods, TMethod>(
      nodeType,
      method,
      ...args
    );
  }
}
```

### 9.4.10 UI拡張

#### 9.4.10.1 UIコンポーネントレジストリ

```typescript
// packages/ui/src/registry/UIComponentRegistry.ts

// コンポーネントプロパティの基本型
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

// 型安全なコンポーネントレジストリ
export class UIComponentRegistry {
  private components: Map<string, React.ComponentType<BaseComponentProps>> = new Map();
  private dialogs: Map<TreeNodeType, React.ComponentType<NodeDialogProps<any>>> = new Map();
  
  registerComponent<TProps extends BaseComponentProps>(
    name: string,
    component: React.ComponentType<TProps>
  ): void {
    this.components.set(name, component as React.ComponentType<BaseComponentProps>);
  }
  
  registerDialog<TEntity extends BaseEntity>(
    nodeType: TreeNodeType,
    dialog: React.ComponentType<NodeDialogProps<TEntity>>
  ): void {
    this.dialogs.set(nodeType, dialog as React.ComponentType<NodeDialogProps<any>>);
  }
  
  getComponent<TProps extends BaseComponentProps = BaseComponentProps>(
    name: string
  ): React.ComponentType<TProps> | undefined {
    return this.components.get(name) as React.ComponentType<TProps> | undefined;
  }
  
  getDialog<TEntity extends BaseEntity = BaseEntity>(
    nodeType: TreeNodeType
  ): React.ComponentType<NodeDialogProps<TEntity>> | undefined {
    return this.dialogs.get(nodeType) as React.ComponentType<NodeDialogProps<TEntity>> | undefined;
  }
}
```

#### 9.4.10.2 動的ダイアログレンダリング

```tsx
// packages/ui/src/containers/DynamicNodeDialog.tsx

interface DynamicNodeDialogProps<TEntity extends BaseEntity = BaseEntity> {
  nodeType: TreeNodeType;
  nodeId?: TreeNodeId;
  onClose: () => void;
  onSave?: (data: Partial<TEntity>) => Promise<void>;
}

export function DynamicNodeDialog<TEntity extends BaseEntity = BaseEntity>(
  { nodeType, nodeId, onClose, onSave }: DynamicNodeDialogProps<TEntity>
) {
  const registry = useUIComponentRegistry();
  const DialogComponent = registry.getDialog<TEntity>(nodeType);
  
  if (!DialogComponent) {
    return (
      <DefaultNodeDialog 
        nodeType={nodeType} 
        nodeId={nodeId} 
        onClose={onClose} 
      />
    );
  }
  
  return (
    <DialogComponent 
      nodeType={nodeType}
      nodeId={nodeId} 
      onClose={onClose}
      onSave={onSave}
    />
  );
}
```


### 9.4.11 想定される使用例

#### 9.4.11.1 基本的な使用パターン
```
// BasemapプラグインのEdit画面
/t/tree-123/node-456/node-789/basemap/edit

// Shapeプラグインのバッチ処理
/t/tree-123/node-456/node-789/shape/batch?step=2

// プラグインなし（通常のツリー表示）
/t/tree-123/node-456
```

#### 9.4.11.2 エッジケース
- 存在しないプラグインタイプへのアクセス → 404表示
- 無効なアクションへのアクセス → 404表示
- 無効なtreeId/nodeId → エラーバウンダリで処理

#### 9.4.11.3 データフロー
1. ブラウザがURLにアクセス
2. React Routerがパラメータを抽出
3. Loaderが階層情報を取得
4. プラグイン固有のデータをロード
5. コンポーネントをレンダリング

### 9.4.12 受け入れ基準

- [ ] 階層的URLパターンが正しく動作する
- [ ] プラグインが動的にロードされる
- [ ] useLoaderDataで階層情報が取得できる
- [ ] ブラウザの履歴が正しく動作する
- [ ] TypeScript型が正しく推論される
- [ ] 存在しないルートで404が表示される
- [ ] プラグインの自動登録が動作する

### 9.4.13 利点

2. **プラグイン拡張性**: 新しいプラグインの追加が容易
3. **型安全性**: TypeScriptによる型推論
4. **遅延ロード**: プラグインコンポーネントの動的インポート
5. **自動登録**: ビルド時のプラグイン自動検出と登録

