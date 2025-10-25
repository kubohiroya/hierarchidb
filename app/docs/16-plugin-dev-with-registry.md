# プラグイン開発とアプリ接続ガイド（静的レジストリ版）

2025-10 時点で HierarchiDB のプラグインは **静的に生成されたレジストリ** を唯一の情報源とします。従来の Vite 仮想モジュール（`virtual:plugin-*`）は廃止され、以下の 3 つの成果物がビルド／実行時の両方で利用されます。

1. `app/src/generated/worker-loader.ts` – Worker 側の EntitiesDB ローダーを nodeType 単位で束ねる。
2. `app/src/generated/ui-loader.ts` – UI の副作用 import を依存順序で列挙し、先にロードすべきプラグインを制御する。
3. `@hierarchidb/plugin-registry` – `pluginDefinitions` / `pluginRegistry` / `pluginMapUI` / `pluginMapWorker` を公開するワークスペース内パッケージ。

これらは `scripts/generate-plugin-loader.mjs` が再生成します。アプリはレジストリの JSON スナップショットを直接読み、`import()` はすべて文字列リテラルなので Vite/Rollup が確実に解決します。

> 重要: ダイアログ拡張は「ステップ提供型」が既定です。プラグインは `PluginStepRegistry` にステップを登録し、ホスト `PluginDialog` が合成します。スタンドアロン型は例外用途に限定してください。

## 仕組みの概要
- **生成スクリプト**: `scripts/generate-plugin-loader.mjs` が `app/package.json` の `@hierarchidb/*-plugin` 依存を列挙し、各プラグインの `exports` と `src/plugin-manifest.ts` を解析して前述の 3 成果物を出力します。
- **Vite 設定**: `@hierarchidb/vite-plugin-node-type-registry` から提供される alias プラグインのみを使用し、`@hierarchidb/<node>-plugin/<kind>` を `/@fs/.../src` に解決します。仮想モジュールは生成しません。
- **実行時**: UI/Worker は `@hierarchidb/plugin-registry` のローダーを呼び出し、Dexie などの EntitiesDB は `worker-loader.ts` が自動的にインスタンス化します。

## プラグイン側の要件
### 1) package.json（最低限）
```jsonc
{
  "name": "@hierarchidb/foo-plugin",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".":          { "types": "./dist/index.d.ts",      "import": "./dist/index.js" },
    "./ui":       { "types": "./dist/ui/index.d.ts",   "import": "./dist/ui/index.js" },
    "./worker":   { "types": "./dist/worker/index.d.ts","import": "./dist/worker/index.js" },
    "./database": { "types": "./dist/database/index.d.ts","import": "./dist/database/index.js" }
  },
  "scripts": {
    "build": "pnpm run build:bundle",
    "build:types": "tsc -p tsconfig.build.json",
    "build:bundle": "NODE_OPTIONS=\"--loader ts-node/esm\" tsup"
  }
}
```
- `exports` は存在するサブパスのみ定義すれば OK です。生成スクリプトは `exports` と `src/` をクロスチェックしてローダーを構成します。
- Worker が `export class FooEntitiesDB` を公開すると、`worker-loader.ts` が自動的に Dexie ラッパーを生成します。

### 2) plugin-manifest.ts（メタデータ）
```ts
// packages/plugins/foo-plugin/src/plugin-manifest.ts
import type { NodeType, PluginMetadata } from '@hierarchidb/common-types';

export const PLUGIN_NODE_TYPE = 'foo' as NodeType;
export const PLUGIN_MANIFEST: PluginMetadata = {
  id: '@hierarchidb/foo-plugin',
  name: 'Foo Plugin',
  displayName: 'Foo',
  nodeType: PLUGIN_NODE_TYPE,
  version: '0.0.1',
  priority: 10,
  icon: { mui: 'Extension', emoji: '🧩', color: '#607d8b' },
  dependencies: ['folder'],
  extends: 'folder',
  description: 'Foo nodes for HierarchiDB',
};
```
- ブランド型 (`as NodeType`) を付与すると `@hierarchidb/common-types` のユーティリティと整合します。
- 追加の capability や schema があれば `capabilities` / `schema` フィールドに追記してください。

### 3) エントリ配置
- `src/index.ts` – 汎用 API（hooks など）をここで再エクスポート。
- `src/ui/index.ts` – ステップ登録や UI 拡張の副作用を定義。
- `src/worker/index.ts` – Worker 側処理。EntitiesDB を公開する場合は `export class FooEntitiesDB` をここで定義。
- `src/database/index.ts` – UI から直接 Dexie にアクセスする際のヘルパー。

## アプリへの接続（自動化フロー）
1. `pnpm dev` / `pnpm build` は事前に `scripts/generate-plugin-loader.mjs` を実行し、最新のレジストリを生成します。
2. Vite の alias プラグインが `@hierarchidb/foo-plugin/ui` → `/@fs/.../packages/plugins/foo-plugin/src/ui/index.ts` のようにマッピング。
3. UI 起動時は `@hierarchidb/plugin-registry` からメタデータとローダーを読み、順次 import。
4. Worker bootstrap でも同じレジストリを参照するため、UI/Worker の整合性が保証されます。

## UI 実装の取り込み例
```ts
// app/src/plugin-loader/auto-load.ts
import { pluginDefinitions, pluginMapUI } from '@hierarchidb/plugin-registry';

const loadOrder = pluginDefinitions
  .map((d) => ({ nodeType: d.nodeType, priority: d.priority ?? 1000 }))
  .sort((a, b) => a.priority - b.priority)
  .map((v) => v.nodeType);

export async function autoLoadPlugins(): Promise<void> {
  for (const nodeType of loadOrder) {
    const loader = pluginMapUI[nodeType];
    if (typeof loader === 'function') {
      await loader();
    }
  }
}
```
- 各 UI モジュールは import 時の副作用で `PluginStepRegistry.registerConfigProvider()` を実行します。

### 型安全なステップ提供
`@hierarchidb/runtime-ui-plugin-dialog` は以下の型を提供します。

```ts
export interface StepComponentProps<TData = unknown> {
  mode: 'create' | 'edit';
  nodeId?: string;
  parentId?: string;
  data: TData;
  onChange: (next: TData) => void;
  setValid: (v: boolean) => void;
  setError: (msg: string | null) => void;
}

export interface PluginStepConfig<TData = unknown> {
  id: string;
  label: string;
  componentFactory: (p: StepComponentProps<TData>) => React.ReactNode;
  optional?: boolean;
  icon?: React.ReactNode;
}
```

プラグイン側では次のように登録します（例: route-plugin）。

```tsx
import React from 'react';
import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { RouteBasicInfoStep } from '../components/RouteBasicInfoStep';

type RouteData = { name: string; routeType?: string };

PluginStepRegistry.getInstance().registerConfigProvider<RouteData>({
  nodeType: 'route',
  getCreateStepConfigs() {
    return [
      {
        id: 'route-basic',
        label: '基本情報',
        componentFactory: (props: StepComponentProps<RouteData>) => <RouteBasicInfoStep {...props} />,
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
```

## Worker 側の取り込み例
```ts
import { pluginDefinitions, pluginMapWorker } from '@hierarchidb/plugin-registry';
import { wirePluginsFromModules } from '@hierarchidb/runtime-client';

const modules = await Promise.all(
  pluginDefinitions.map(async (definition) => {
    const loader = pluginMapWorker[definition.nodeType];
    if (typeof loader !== 'function') return null;
    try {
      const mod = await loader();
      return { nodeType: definition.nodeType, mod };
    } catch (error) {
      console.warn('[worker] failed to load plugin worker', definition.nodeType, error);
      return null;
    }
  }),
);

await wirePluginsFromModules(modules.filter(Boolean) as Array<{ nodeType: string; mod: unknown }>);
```

## アイコンマップ
- プラグインは `plugin-manifest.ts` の `icon.mui`（または `muiIconName`）/`emoji` を設定してください。
- `pnpm run tools:gen-plugin-loaders` 実行時に `app/src/generated/mui-icon-loader.ts` が再生成され、`setGlobalMuiIconMap()` へ渡す MUI Icon マップを静的に用意します。

## 手動メンテが必要なケース
- 新しいプラグインを追加したのにレジストリへ反映されない → `pnpm dev` などで `scripts/generate-plugin-loader.mjs` が走っているか確認し、`app/package.json` の dependencies に対象プラグインを追加してください。
- エイリアス解決が古いまま → `pnpm --filter @hierarchidb/vite-plugin-node-type-registry build` で dist を再生成するか、Vite dev server を再起動する。

## チェックリスト（プラグイン追加時）
1. `packages/plugins/<node>-plugin` を作成し、`package.json` で `@hierarchidb/<node>-plugin` を宣言。
2. `exports` に必要なサブパス (`./ui`, `./worker`, `./database`) を登録。存在しないものは省略。
3. `src/plugin-manifest.ts` で `PLUGIN_MANIFEST` を定義し、依存関係や優先度を記述。
4. UI/Worker のエントリポイントを `src/ui/index.ts`, `src/worker/index.ts` へ配置。
5. `pnpm --filter @hierarchidb/<node>-plugin build` で dist を生成。
6. `pnpm --filter @hierarchidb/app typecheck` / `pnpm --filter @hierarchidb/app test` を実行し、エラーが無いことを確認。

## FAQ
- **Q. プラグインから `@hierarchidb/app` のコードを直接 import できますか？**  
  **A.** できません。プラグインはホストとは独立したパッケージとして設計されているため、`packages/<scope>` や `plugins/<node>-plugin` の依存関係に限定してください。
- **Q. 仮想モジュールは完全に無くなりましたか？**  
  **A.** プラグインローダー/メタデータに加え、MUI アイコンマップも静的生成へ移行済みです。現在はアプリ固有の仮想モジュールを使用していません。
- **Q. `tsconfig` の paths をどう管理しますか？**  
  **A.** 共通の `tsconfig.base.json` に `@hierarchidb/*` の `src/` を集約しました。個別の tsconfig で dist を参照しないでください。
