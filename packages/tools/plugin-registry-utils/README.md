# @hierarchidb/tools-plugin-registry-utils

Utility helpers shared across the HierarchiDB plugin registry toolchain.

- Discover node-type plugins and their public subpath exports.
- Generate Vite alias entries that point to workspace `src` files during development.
- Keep `tsconfig` `paths` in sync so imports resolve without manual edits.
- Expose a reusable Vite plugin that wires everything together automatically.

The package is ESM-only and targets Node 18+.

## Quick start

```ts
// app/vite.config.ts
import { createNodeTypeAliasPlugin } from '@hierarchidb/tools-plugin-registry-utils';

export default defineConfig(({ mode }) => ({
  plugins: [
    createNodeTypeAliasPlugin({
      rootDir: path.resolve(__dirname, '..'),
      subpaths: ['services', 'database'],
      tsconfigPath: path.resolve(__dirname, 'tsconfig.json'),
      tsconfigSubpaths: ['services', 'database'],
    }),
  ],
}));
```

At build time the plugin scans `packages/plugins/*-plugin/package.json`, detects
their `exports` subpaths and:

1. Injects Vite `resolve.alias` entries that point at the corresponding `src/` files.
2. Updates the provided `tsconfig` so TypeScript sees the same alias.

You can call the lower-level helpers directly when you need finer control:

```ts
import {
  discoverNodeTypePlugins,
  deriveNodeTypePluginAliases,
  syncNodeTypeAliasesToTsconfig,
} from '@hierarchidb/tools-plugin-registry-utils';

const plugins = discoverNodeTypePlugins({ rootDir: process.cwd() });
const aliases = deriveNodeTypePluginAliases(plugins, { subpaths: ['services'] });
syncNodeTypeAliasesToTsconfig({
  rootDir: process.cwd(),
  tsconfigPath: 'app/tsconfig.json',
  subpaths: ['services'],
});
```

## Scripts

```
pnpm --filter @hierarchidb/tools-plugin-registry-utils build
pnpm --filter @hierarchidb/tools-plugin-registry-utils test
pnpm --filter @hierarchidb/tools-plugin-registry-utils typecheck
```
