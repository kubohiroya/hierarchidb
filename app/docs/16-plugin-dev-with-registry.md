# プラグイン開発とアプリ接続ガイド（レジストリ生成方式）

本書は、Vite の仮想モジュール生成（virtual modules）を用いた「静的に解決可能なプラグインレジストリ」を前提に、
新規プラグインの開発とアプリ本体への接続手順をまとめたガイドです。開発/本番ともに動的パス連結を廃し、
ビルド時に生成された TypeScript から文字列リテラルの import() を使ってプラグインを解決します。

この方式により、開発中の解決失敗ログを無くしつつ、コード分割（lazy load）やキャッシュの利点を維持します。

> 2025-09 追記（重要）
> - UI ダイアログは「拡張専用（ホスト合成）」を既定とします。各プラグインは「ステップ」だけを提供し、汎用ホスト `PluginDialog` に合成されます。
> - 型安全な Step API（componentFactory + StepComponentProps）を導入し、`as any` に依存しない実装が可能になりました。
> - 既存のスタンドアロン型（プラグインがダイアログ全体を提供）は例外用途とし、段階的にステップ提供型へ移行してください。

## 仕組みの概要
- 生成プラグイン（Vite）
  - `app/vite-plugin-registry.ts`（UI/Worker のレジストリ）
    - 走査対象: `packages/plugins/*-plugin/package.json`
    - 生成: `virtual:plugin-registry-ui`, `virtual:plugin-registry-worker`
      - `pluginMapUI = { nodeType: () => import('<pkg>') }`
      - `pluginMapWorker = { nodeType: () => import('<pkg>/worker') | async () => ({ default: {} }) }`
  - `app/vite-plugin-plugin-services.ts`（Services/DB レジストリ）
    - 走査対象: 同上
    - 生成: `virtual:plugin-registry-services`
      - `pluginServices = { nodeType: () => import('<pkg>/services|/database|/shared') | async () => ({}) }`
  - `app/vite-plugin-mui-icon-map.ts`（アイコンマップ）
    - 走査対象: 同上
    - 生成: `virtual:mui-icon-map`（`{ 'AccountTree': AccountTreeIcon, ... }` を静的 import して map を export）
- アプリ側の利用箇所
  - Worker: `virtual:plugin-registry-worker` を取り込み、nodeType→loader のマップを使用
  - UI: `virtual:plugin-registry-ui` を取り込み、メニューやダイアログ等のロードに使用
  - アイコン: `virtual:mui-icon-map` を `setGlobalMuiIconMap()` で注入（実描画は静的解決）
- メタデータ
  - 一次情報は各プラグインの `src/extension/plugin-manifest.ts`
  - `virtual:plugin-definitions`（tools-vite-plugin-package-reader 由来）は manifest から収集した表示名/順序などを提供

## プラグイン側の要件
### 1) package.json（最低限）
```jsonc
{
  "name": "@hierarchidb/<foo>-plugin",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./worker": { "import": "./dist/worker/index.js" } // Worker不要なら省略可
  },
  "scripts": { "build": "tsup" }
}
```
- `exports["./worker"]` は Worker を公開する場合のみ必要（Linker のように不要なら省略）
- メタデータは `src/extension/plugin-manifest.ts` に記述する（次項）。`package.json` からは撤去済み

### 2) plugin-manifest.ts（拡張メタデータ）
```ts
// src/extension/plugin-manifest.ts
import { toNodeType, type PluginMetadata } from '@hierarchidb/common-type';

export const PLUGIN_ID = '@hierarchidb/foo-plugin' as const;
export const PLUGIN_VERSION = '0.0.1' as const;
export const PLUGIN_DESCRIPTION = 'Foo nodes for HierarchiDB' as const;

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Foo Plugin',
  displayName: 'Foo',
  nodeType: toNodeType('foo'),
  version: PLUGIN_VERSION,
  priority: 10,
  icon: {
    mui: 'Extension',
    emoji: '🧩',
    color: '#607d8b'
  },
  dependencies: ['folder'],
  extends: 'folder',
  description: PLUGIN_DESCRIPTION,
};

export type FooPluginManifest = typeof PLUGIN_MANIFEST;
```
- `nodeType` はプラグインを識別する文字列。`toNodeType()` で型整合性を確保
- バージョンや説明などのメタデータは `PACKAGE_VERSION` 定数などとして TypeScript 内で管理する（`package.json` import は不要）
- `icon.mui`（または `muiIconName`）は MUI Icons の PascalCase 名称
- 追加の capability/schema などもこのオブジェクトに追記する

### 3) エントリ配置
- UI: `src/index.ts`（アプリが `@hierarchidb/<foo>-plugin` を動的 import）
- Worker（任意）: `src/worker/index.ts`（アプリが `@hierarchidb/<foo>-plugin/worker` を動的 import）
- ビルド: tsup で `dist/` に出力（exports に合わせる）

## アプリへの接続（自動）
- 開発時は Vite が `packages/plugins/*-plugin/src/extension/plugin-manifest.ts` を監視し、以下を再生成します。
  - `virtual:plugin-registry-ui` … UI ローダ
  - `virtual:plugin-registry-worker` … Worker ローダ
  - `virtual:mui-icon-map` … アイコンマップ
- `@hierarchidb/tools-plugin-registry-utils` が Vite エイリアス／`tsconfig` の `paths` を自動同期します。`@hierarchidb/plugins-*-plugin/services` や `/database` などのパスを手動で追加する必要はありません。
- 文字列リテラルの import() なので、Vite/Rollup が確実に解決・分割し、GitHub Pages でも問題ありません。

## UI 実装の取り込み例
- メニュー構築やダイアログで `virtual:plugin-registry-ui` を用いる例（要約）
```ts
// app/src/plugins/auto-load.ts
import { pluginMapUI as pluginMap } from 'virtual:plugin-registry-ui';

for (const nodeType of loadOrder) {
  const loader = (pluginMap as Record<string, () => Promise<unknown>>)[nodeType];
  if (typeof loader === 'function') await loader(); // ここでUIを遅延ロード
}
```

各 UI エントリは import 時の副作用として `PluginStepRegistry.registerConfigProvider()` を実行し、ホスト `PluginDialog` へステップを登録します。

### 型安全なステップ提供（拡張専用、ホスト合成）

`@hierarchidb/runtime-ui-plugin-dialog` に以下の型が用意されています。

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
  validate?: () => boolean | Promise<boolean>;
  optional?: boolean;
  icon?: React.ReactNode;
}

export interface PluginStepConfigProvider<TData = unknown> {
  nodeType: string;
  getCreateStepConfigs(): PluginStepConfig<TData>[];
  getEditStepConfigs(nodeId: string, data?: TData): PluginStepConfig<TData>[];
  validateAccess?(nodeId?: string): Promise<boolean>;
}
```

プラグインの UI で次のように登録します（例: route-plugin）。

```tsx
// packages/plugins/route-plugin/src/ui/steps-provider.tsx
import React from 'react';
import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { RouteBasicInfoStep } from '../components/RouteBasicInfoStep';
import { RouteSelectionStep } from '../components/RouteSelectionStep';
import { RouteProcessingStep } from '../components/RouteProcessingStep';

type RouteData = { name: string; routeType?: string };

PluginStepRegistry.getInstance().registerConfigProvider<RouteData>({
  nodeType: 'route',
  getCreateStepConfigs() {
    const bind = (C: React.FC<any>) => (p: StepComponentProps<RouteData>) => (
      <C
        workingCopy={p.data}
        onUpdate={(u: Partial<RouteData>) => p.onChange({ ...(p.data || {}), ...u })}
        onValidationChange={p.setValid}
      />
    );
    return [
      { id: 'basic', label: 'Basic Information', componentFactory: bind(RouteBasicInfoStep), validate: () => true },
      { id: 'select', label: 'Route Selection', componentFactory: bind(RouteSelectionStep) },
      { id: 'process', label: 'Processing', componentFactory: bind(RouteProcessingStep) },
    ];
  },
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
```

ポイント:
- `componentFactory` の引数 `StepComponentProps<TData>` をそのまま使えるため `as any` は不要です。
- Step は `data/onChange` にのみ依存すればよく、保存やナビゲーション等はホストが担います。

## Worker 実装の取り込み例
- Worker 側初期化で `virtual:plugin-registry-worker` を用いる例（要約）
```ts
// app/src/worker.ts
const { pluginMapWorker } = await import('virtual:plugin-registry-worker');
let pluginMap = pluginMapWorker || {};
// 必要に応じて手動オーバーライドを合成（Devソースに差し替え等）
```

## アイコンの解決
- `virtual:mui-icon-map` を `root.tsx` で読み込み、`setGlobalMuiIconMap()` に渡します。
- 以後は `@hierarchidb/ui-icon` が静的マップから解決し、動的 import を極力回避します。

## Services/DB の取り込み例
- 共通ファサード（例）
```ts
// app/src/services/plugin-services.ts
import { loadPluginService } from '~/services/plugin-services';

const db = await loadPluginService('shape'); // exports['./database'] や ./shared を静的import
```

> 補足: 各プラグインの package.json に `exports['./services']` あるいは `./database`/`./shared` を追加すると、
> 自動的にレジストリへ登録されます。未定義のプラグインは no-op（空モジュール）になります。

## Lazy/Eager の切替
- 既定は Lazy（`() => import('...')`）。初期バンドルを小さく保てます。
- すべてのプラグインを初期読み込みしたい場合は、生成側を `import '...'; export const ... = { foo: async () => ({}) }` のように Eager 版へ切替可能です（プラグイン側の要望に応じてカスタマイズ）。

## よくある落とし穴と対処
- アイコンが表示されない
  - `src/extension/plugin-manifest.ts` の `icon.mui`（または `muiIconName`）を PascalCase で記述（例: `AccountTree`）
  - 変更後は devサーバが自動再生成（HMR）。表示が変わらなければ一度再起動
- Worker が期待どおり動かない
  - `exports["./worker"]` が存在するか確認。`dist/worker/index.js` を export しているか
  - Worker不要なプラグインはダミーとして扱われ、呼び出しが無視されます
- GitHub Pages での挙動
  - 仮想モジュールはすべてビルド時に JS へ実体化・分割。追加設定は不要

### as any を使わずに書くコツ
- JSX を含むファイルは `.tsx` にし、Step の props 型を import して合わせる。
- Step が独自 props（例: `workingCopy`/`onUpdate`）を想定している場合でも、`componentFactory` で `StepComponentProps<TData>` にブリッジすれば OK。
- ホスト `PluginDialog` 側は `StepComponentProps` をそのまま渡すため、キャスト不要です。

## 新規プラグインの最短テンプレート
```
packages/plugins/foo-plugin/
├── package.json   // 上記の例に準拠
├── tsup.config.ts // createTsupConfig({ entry: ['src/index.ts', 'src/worker/index.ts'] }) 等
└── src/
    ├── index.ts        // UI エントリ（必要な export をまとめる）
    └── worker/
        └── index.ts    // Worker エントリ（不要なら作らない）
```

## 既存プロジェクトへの導入手順（要約）
1) プラグインごとの `package.json` に `exports` を整備し、`src/extension/plugin-manifest.ts` を追加
2) アプリの Vite 設定に `pluginRegistryPlugin` と `muiIconMapPlugin` を追加（本リポジトリは導入済み）
3) 旧来の `virtual:plugin-map` 依存を `virtual:plugin-registry-ui/worker` に置き換え
4) 旧来の動的 bare specifier import を撤去（本ガイドの方式へ移行）

### スタンドアロン → ステップ合成への移行
1) 各プラグインに `src/ui/steps-provider.tsx` を追加し、`registerConfigProvider()` でステップ定義を登録。
2) ルーティング/SpeedDial はホスト `PluginDialog` へ統一（`getDialogComponent()` の利用は段階的に縮退）。
3) evaluator/validation はホスト側で AND 合成されるため、既存ロジックをそのまま移設・併用可能です。

---

お問い合わせ・拡張
- services/DB 用のレジストリ（`virtual:plugin-registry-services`）も同様に追加可能です（exports に専用エントリを設けて参照）。
- Eager ロードやビルド分割戦略はプロダクト要件に合わせて調整できます。必要なら提案します。
