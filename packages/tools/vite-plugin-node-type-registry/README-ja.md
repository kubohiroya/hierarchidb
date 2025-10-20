# @hierarchidb/vite-plugin-node-type-registry

HierarchiDB の nodeType プラグインを検出し、Vite からソースコードへ解決できるよう alias を付与する最小限のプラグインです。従来このパッケージは仮想モジュール (`virtual:plugin-*`) を生成していましたが、2025-10 時点では静的レジストリ (`scripts/generate-plugin-loader.mjs` → `@hierarchidb/plugin-registry`) が正となったため、役割を「エイリアス整備のみに限定」しました。

## できること
- `packages/plugins/*-plugin` を探索し、`./ui` や `./worker` 等のサブパスが存在する場合に Vite の `resolve.alias` へ `/@fs/.../src` を登録する
- （任意）`tsconfig` の `paths` を同期させるオプションを残しつつ、デフォルトでは書き換えを行わない

> 💡 プラグイン定義・ロード順・メタデータは `@hierarchidb/plugin-registry` によって提供されます。UI や Worker からは `import { pluginDefinitions } from '@hierarchidb/plugin-registry'` のように参照してください。

## 使い方

```ts
// app/vite.config.ts
import { defineConfig } from 'vite';
import { createNodeTypeAliasPlugin } from '@hierarchidb/vite-plugin-node-type-registry';

export default defineConfig({
  plugins: [
    createNodeTypeAliasPlugin({
      rootDir: path.resolve(__dirname, '..'), // plugins/ ディレクトリを探索するルート
      // tsconfigPath や kinds は必要に応じて指定
    }),
  ],
});
```

エイリアスの例:

- `@hierarchidb/route-plugin/ui` → `/@fs/<repo>/plugins/route-plugin/src/ui/index.ts`
- `@hierarchidb/route-plugin/worker` → `/@fs/<repo>/plugins/route-plugin/src/worker/index.ts`
- `@hierarchidb/route-plugin` → `/@fs/<repo>/plugins/route-plugin/src/index.ts`

これにより、開発時は常に `src/` を直接参照でき、ビルド時はパッケージの `exports`（dist）へフォールバックします。

## オプション

```ts
createNodeTypeAliasPlugin({
  rootDir?: string;           // 省略時はリポジトリ ルート
  kinds?: ('ui'|'worker'|'database'|'common'|'root')[]; // デフォルトは全種
  tsconfigPath?: string;      // 指定した場合のみ paths を同期
  tsconfigKinds?: ...         // tsconfig へ同期するカテゴリ（tsconfigPath 指定時に使用）
});
```

## スクリプト

```bash
pnpm --filter @hierarchidb/vite-plugin-node-type-registry build
pnpm --filter @hierarchidb/vite-plugin-node-type-registry typecheck
pnpm --filter @hierarchidb/vite-plugin-node-type-registry lint
```

## ライセンス
MIT
