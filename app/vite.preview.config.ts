import { defineConfig, loadEnv } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';

type AliasEntry = { find: string; replacement: string };

function addAliasIfExists(rootDir: string, relativePath: string, find: string, target: AliasEntry[]) {
  const absolutePath = path.resolve(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return;
  target.push({ find, replacement: absolutePath });
}

// PreviewStep-specific config without React Router plugin
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || '';
  const base = appName ? `/${appName}/` : '/';
  const rootDir = __dirname;

  const aliases: AliasEntry[] = [];
  addAliasIfExists(rootDir, '../packages/runtime/worker/dist/index.js', '@hierarchidb/runtime-worker', aliases);
  addAliasIfExists(rootDir, '../packages/runtime/worker-bootstrap/dist/index.js', '@hierarchidb/runtime-worker-bootstrap', aliases);
  addAliasIfExists(rootDir, '../packages/feature/map-adapter/dist/index.js', '@hierarchidb/map-adapter', aliases);
  addAliasIfExists(rootDir, '../packages/feature/tabular-xlsx/dist/index.js', '@hierarchidb/tabular-xlsx', aliases);
  addAliasIfExists(rootDir, '../packages/util/dist/index.js', '@hierarchidb/util', aliases);
  addAliasIfExists(rootDir, '../packages/ui/core/dist/index.js', '@hierarchidb/ui-core', aliases);
  addAliasIfExists(rootDir, '../packages/ui/icon/src/RuntimeWorkerService.ts', '@hierarchidb/ui-icon', aliases);
  addAliasIfExists(rootDir, '../packages/runtime-ui/plugin-dialog/src/RuntimeWorkerService.ts', '@hierarchidb/runtime-ui-plugin-dialog', aliases);
  addAliasIfExists(rootDir, '../packages/plugin-loader/base-plugin/dist/index.js', '@hierarchidb/plugin-loader-base-plugin', aliases);

  return {
    base,
    preview: {
      port: 4173,
      open: true,
      host: true,
    },
    build: {
      outDir: 'build/client',
    },
    resolve: {
      alias: aliases,
    },
    optimizeDeps: {
      exclude: [
        '@hierarchidb/runtime-worker',
        '@hierarchidb/runtime-worker-bootstrap',
        '@hierarchidb/map-adapter',
        '@hierarchidb/tabular-xlsx',
        '@hierarchidb/runtime-ui-plugin-dialog',
      ],
    },
  };
});
