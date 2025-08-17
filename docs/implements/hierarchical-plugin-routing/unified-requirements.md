# 統合版：階層的URLパターンでのプラグインルーティングシステム

## 統合方針

既存のeria-cartographパターンを維持しながら、プラグインシステムを統合する。

## URLパターン設計

### 基本パターン
```
/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?
```

- `treeNodeType`: プラグイン識別子として機能（basemap, shapes, locations等）
- `action`: プラグイン内のアクション（edit, preview, batch, settings等）

### 具体例
```
# 通常のツリー表示（プラグインなし）
/t/tree-123/node-456

# BasemapプラグインのEdit画面
/t/tree-123/node-456/node-789/basemap/edit

# ShapesプラグインのBatch処理
/t/tree-123/node-456/node-789/shapes/batch?step=2
```

## ファイル構造（修正版）

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

## プラグイン統合メカニズム

### プラグインレジストリ
```typescript
// packages/app/src/plugins/registry.ts
export interface PluginDefinition {
  nodeType: string;  // treeNodeTypeと一致（basemap, shapes等）
  actions: {
    [actionName: string]: {
      component: React.LazyExoticComponent<React.ComponentType>;
      loader?: LoaderFunction;
      action?: ActionFunction;
      permissions?: string[];
    };
  };
}

export const pluginRegistry = new Map<string, PluginDefinition>();

// プラグイン登録
pluginRegistry.set('basemap', {
  nodeType: 'basemap',
  actions: {
    'edit': {
      component: lazy(() => import('@hierarchidb/plugin-basemap/edit')),
      loader: basemapEditLoader,
      permissions: ['basemap:edit']
    },
    'preview': {
      component: lazy(() => import('@hierarchidb/plugin-basemap/preview')),
      loader: basemapPreviewLoader,
      permissions: ['basemap:view']
    }
  }
});
```

### 動的ルートコンポーネント
```tsx
// packages/app/src/routes/t/$treeId/$pageTreeNodeId/$targetTreeNodeId/$treeNodeType/$.tsx
import { useParams, useLoaderData } from 'react-router-dom';
import { pluginRegistry } from '@/plugins/registry';
import { NotFound } from '@/components/NotFound';
import { Forbidden } from '@/components/Forbidden';

export const loader: LoaderFunction = async ({ params, request }) => {
  const { treeId, pageTreeNodeId, targetTreeNodeId, treeNodeType } = params;
  const action = params['*'];  // キャッチオールパラメータ
  
  // プラグイン取得
  const plugin = pluginRegistry.get(treeNodeType);
  if (!plugin) {
    throw new Response('Plugin not found', { status: 404 });
  }
  
  const pluginAction = plugin.actions[action || 'index'];
  if (!pluginAction) {
    throw new Response('Action not found', { status: 404 });
  }
  
  // 権限チェック
  if (pluginAction.permissions && !hasPermissions(pluginAction.permissions)) {
    throw new Response('Forbidden', { status: 403 });
  }
  
  // 階層情報を取得
  const treeContext = await loadTreeContext(treeId, pageTreeNodeId);
  const targetNode = await loadNode(targetTreeNodeId);
  
  // プラグイン固有のローダーを実行
  const pluginData = pluginAction.loader 
    ? await pluginAction.loader({ params, request })
    : null;
  
  return {
    treeContext,
    targetNode,
    pluginData,
    action: action || 'index'
  };
};

export default function PluginRoute() {
  const { treeContext, targetNode, pluginData, action } = useLoaderData();
  const { treeNodeType } = useParams();
  
  const plugin = pluginRegistry.get(treeNodeType!);
  const PluginComponent = plugin?.actions[action]?.component;
  
  if (!PluginComponent) {
    return <NotFound />;
  }
  
  return (
    <Suspense fallback={<Loading />}>
      <PluginComponent 
        treeContext={treeContext}
        targetNode={targetNode}
        pluginData={pluginData}
      />
    </Suspense>
  );
}
```

## プラグイン開発側の実装

```typescript
// packages/plugins/basemap/src/index.ts
export { default as EditComponent } from './components/Edit';
export { default as PreviewComponent } from './components/Preview';
export { editLoader, previewLoader } from './loaders';
export { editAction, previewAction } from './actions';
```

```tsx
// packages/plugins/basemap/src/components/Edit.tsx
export default function BasemapEdit({ treeContext, targetNode, pluginData }) {
  const { basemapEntity } = pluginData;
  
  return (
    <div>
      <Breadcrumbs items={treeContext.breadcrumbs} />
      <h1>Edit Basemap: {targetNode.name}</h1>
      <BasemapEditor entity={basemapEntity} />
    </div>
  );
}
```

## ビルド時の自動登録

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
              permissions: ${JSON.stringify(config.permissions)}
            }
          `).join(',')}
        }
      });
    `;
  }
  
  await writeFile('packages/app/src/plugins/registry.generated.ts', registryCode);
}
```

## 利点

1. **URL互換性**: 既存のeria-cartographパターンを維持
2. **プラグイン拡張性**: 新しいプラグインの追加が容易
3. **型安全性**: TypeScriptによる型推論
4. **権限管理**: アクションレベルでの権限制御
5. **遅延ロード**: プラグインコンポーネントの動的インポート

## 移行パス

1. 既存のURLパターンは変更なし
2. プラグインは`treeNodeType`として認識
3. 段階的にプラグインを追加可能