# @hierarchidb/vite-plugin-node-type-registry

HierarchiDB の nodeType プラグイン群を自動検出し、UI/Worker/Services 向けの仮想モジュールとエイリアスを提供する Vite プラグインです。既存の `vite-plugin-registry.ts` / `vite-plugin-services.ts` / `@hierarchidb/tools-plugin-registry-utils` を統合する後継パッケージとして設計されています。

## 目的
- `packages/plugins/*-plugin` 配下のパッケージを検出し、nodeType ごとのメタデータを生成する
- Vite の仮想モジュール (`virtual:plugin-node-types/*`) を通じて UI/Worker/Services のレジストリを提供する
- tsconfig と Vite alias の同期を自動化し、手動メンテナンスを不要にする
- フィーチャーフラグやデバッグ出力（スナップショット生成）を統一的に制御する

## 設計概要
- **Detector レイヤ**: `packages/plugins/*-plugin` を探索し、`package.json` の `hierarchidb.plugin` と exports からメタ情報を収集します。`plugin-manifest.ts` の変更も監視対象に含め HMR をトリガーします。
- **Transform レイヤ**: 収集したプラグイン情報を nodeType 毎の構造へ整形し、優先度・依存関係・UI/Worker/Services サブパスを決定します。
- **Virtual Module レイヤ**: UI/Worker/Services に対応する仮想モジュールを生成し、`try/catch` ベースのフォールバックやデバッグ用スナップショット (`app/.debug/*`) を出力します。
- **Alias/Path 同期レイヤ**: Vite の `resolve.alias` と `tsconfig.*.json` の `paths` を自動更新し、`@hierarchidb/*-plugin/services` 等の参照を常に最新に保ちます。

## エントリカテゴリと利用層
- **UI**: ブラウザメインスレッドで実行される UI コンポーネント／フック群（React など）。アプリ側では `pluginMapUI['location']()` のように読み込み、各 nodeType の UI をマウントします。
- **Worker**: Web Worker 内で動作するバックエンドロジック。`pluginMapWorker['location']()` で読み込み、IndexedDB 操作や長時間処理を実装します。
- **Services**: UI/Worker 共有の RPC 風 API やデータアクセス層。`pluginServices['location']()` を通じてメインスレッドからサービス関数群を取得します。`./services` が無い場合は `./database` などのバックアップサブパスへ自動フォールバックします。

各カテゴリは `package.json` の `exports` で `./ui` / `./worker` / `./services` を定義しておくことで自動検出されます。特定カテゴリのみを提供するプラグインもサポートされます。

## Location プラグイン（例）の内部フロー
1. Detector が `packages/plugin-/location-plugin/package.json` を読み込み、`hierarchidb.plugin.nodeType` を `location` として取得。
2. `exports` フィールドから `./worker`, `./ui`, `./services` のサブパス有無を確認し、存在するパスに対応する `dist/` ファイルへの絶対パスを `/@fs/` 形式で解決。
3. Transform レイヤが `plugin-manifest.ts` から優先度・依存関係・Runtime 設定（例: `dependencies: ['route', 'shape']`）を抽出し、`location` 用のメタデータを組み立て。
4. Virtual Module レイヤが次の仮想モジュールを生成:
   - `virtual:plugin-node-types/maps`: `location` キーで UI/Worker のエントリポイントを登録（Worker 版は `@hierarchidb/location-plugin/worker` 等）。
   - `virtual:plugin-node-types/services`: `location` 用のサービスエントリを優先順位に従って `() => import('@hierarchidb/location-plugin/services')` で提供。
   - デバッグモードでは `app/.debug/plugin-node-types-location.json` 等のスナップショットを出力。
5. Alias/Path 同期レイヤが `@hierarchidb/location-plugin/services` といった tsconfig パスを `packages/plugin-/location-plugin/src/services/index.ts` へ向けるよう自動更新。

## 使い方

### Vite 設定への組み込み

```ts
// app/vite.config.ts
import { defineConfig } from 'vite';
import {
  createNodeTypeRegistryPlugin,
  createNodeTypeAliasPlugin,
} from '@hierarchidb/vite-plugin-node-type-registry';

export default defineConfig({
  plugins: [
    createNodeTypeAliasPlugin({
      rootDir: __dirname,
      tsconfigPath: './tsconfig.json',
    }),
    createNodeTypeRegistryPlugin({
      rootDir: __dirname,
      debugSnapshotDir: './app/.debug',
    }),
  ],
});
```

### 非同期 onRegister の取り扱い
- UI・Worker・Services のどのカテゴリでも、プラグインは任意で `export async function onRegister(): Promise<void>` を定義できます。主な用途は Web Worker 起動時のリソース初期化や外部サービスとの接続など、インポートだけでは完結しない非同期処理です。
- 仮想モジュールのローダーは `import()` 後に `onRegister` を自動実行し、完了するまで待機してからモジュールを返します。
- 呼び出し側は単に `await pluginMapWorker['location']()` のように利用するだけで、初期化済みモジュールを取得できます。`onRegister` が未定義の場合は即座にモジュールが返ります。

### Location プラグインの呼び出し例

```ts
// app/src/features/location/loaders.ts
import { pluginMapUI, pluginMapWorker } from 'virtual:plugin-node-types/maps';
import { pluginServices } from 'virtual:plugin-node-types/services';

export async function mountLocationUI(root: HTMLElement) {
  const loader = pluginMapUI['location'];
  const module = await loader();
  module.render(root);
}

export async function loadLocationWorker() {
  const moduleLoader = pluginMapWorker['location'];
  const { default: workerModule } = await moduleLoader();
  return workerModule;
}

export async function loadLocationServices() {
  const importFn = pluginServices['location'];
  const { default: services } = await importFn();
  return services;
}
```

上記の `pluginMapWorker['location']` は Detector/Transform レイヤが自動で登録した `@hierarchidb/location-plugin/worker` のエントリへの `() => import()` を返します。プラグインが `onRegister` を export している場合でも、呼び出し側は追加の処理を実装する必要はありません。

### フィーチャーフラグ / デバッグ設定

- `HDB_PLUGIN_DEBUG_MODE=1`: 仮想モジュール生成時に `app/.debug` へスナップショットを出力
- `HDB_PLUGIN_MINIMAL=1`: 仮想モジュールを空実装に差し替え、Vite の import 解析を簡略化

## 既存実装からの移行ガイド
- `app/vite-plugin-registry.ts` / `app/vite-plugin-services.ts` のロジックは本プラグインへ取り込まれます。従来ファイルは削除し、Vite 設定から新プラグインを読み込むよう更新してください。
- `@hierarchidb/tools-plugin-registry-utils` の `createNodeTypeAliasPlugin` / `syncNodeTypeAliasesToTsconfig` は本パッケージが代替します。
- 仮想モジュールのインポートパスが `virtual:plugin-registry-*` から `virtual:plugin-node-types/*` に変更されるため、アプリ側の import を更新してください。

## スクリプト

```bash
pnpm --filter @hierarchidb/vite-plugin-node-type-registry build
pnpm --filter @hierarchidb/vite-plugin-node-type-registry typecheck
pnpm --filter @hierarchidb/vite-plugin-node-type-registry lint
```

## ライセンス
MIT
