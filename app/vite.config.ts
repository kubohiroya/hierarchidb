import { defineConfig, loadEnv } from 'vite';
// @ts-ignore
import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import * as fs from 'fs';
import { faviconPlugin } from './vite-plugin-favicon';
import { comlink } from 'vite-plugin-comlink';
import {
  vitePluginPackageReader as toolsVitePluginPackageReader,
} from '@hierarchidb/tools-vite-plugin-package-reader';
import { hierarchiDBMultiModulePreset } from '@hierarchidb/tools-vite-plugin-package-reader/presets';

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  // 環境変数を読み込む
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || '';
  // VITE_APP_NAMEが設定されている場合のみbaseを設定
  const base = appName ? `/${appName}/` : '/';
  // const isDev = mode === 'development';

  // プラグインのリストを作成（main thread）
  const plugins = [
    // HierarchiDB plugin package discovery -> virtual modules
    toolsVitePluginPackageReader({
      ...hierarchiDBMultiModulePreset({
        // 使用対象のプラグインのみ検出（不完全な spreadsheet-plugin を除外）
        pattern: /@hierarchidb\/(basemap-plugin|project-plugin|folder-plugin|shape-plugin|styler-plugin|route-plugin|location-plugin)$/,
        priorityPlugin: 'folder',
        extractPluginConfig: true,
      }),
      // モノレポのルートを明示して検出を安定化
      rootDir: path.resolve(__dirname, '..'),
      hooks: {
        // 念のため、transform 前に明示的に除外
        beforeTransform: async (packages) => {
          packages.delete('@hierarchidb/spreadsheet-plugin');
          return packages;
        },
      },
    }),
    dts({
      outDir: isSsrBuild ? 'build/server-types' : 'build/client-types',
      rollupTypes: false,
      insertTypesEntry: false,
      copyDtsFiles: true,
    }),
    faviconPlugin(), // Add favicon plugin to serve favicon at root
    comlink(), // Add Comlink plugin for Worker support
    reactRouter(),
    tsconfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ];

  return {
    base,
    define: (() => {
      // Inject version and build time for logging
      let appVersion = '0.0.0-dev';
      try {
        const pkgPath = path.resolve(__dirname, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
        if (pkg?.version) appVersion = pkg.version;
      } catch {}
      const buildTime = new Date().toISOString();
      return {
        __APP_VERSION__: JSON.stringify(appVersion),
        __BUILD_TIME__: JSON.stringify(buildTime),
      } as Record<string, string>;
    })(),
    plugins,
    resolve: {
      // @emotion/reactとreactの重複を解決
      dedupe: ['@emotion/react', '@emotion/styled', 'provider', 'provider-dom'],
      alias: [
        // ローカルソースのエイリアスのみ
        { find: '~', replacement: path.resolve(__dirname, './src') },
        // Virtual modules are provided by tools-vite-plugin-package-reader
        // (no fallback alias here to ensure worker also gets virtual modules)
        { find: 'crypto', replacement: path.resolve(__dirname, './src/virtual/crypto-shim.ts') },
        // Aliases for legacy provider package names used in some plugins
        { find: 'provider-i18next', replacement: 'react-i18next' },
        // Specific deep import aliases MUST come before package root aliases
        // Map deep components path to ui-core source components (placed before root alias)
        { find: '@hierarchidb/ui-core/components', replacement: path.resolve(__dirname, '../packages/ui/core/src/components') },
        // ワークスペース解決が不安定な場合の保険（Rollup の解決を安定化）
        { find: '@hierarchidb/ui-core', replacement: path.resolve(__dirname, '../packages/ui/core') },
        { find: '@hierarchidb/ui-dialog', replacement: path.resolve(__dirname, '../packages/ui/dialog/src/index.ts') },
        { find: '@hierarchidb/ui-theme', replacement: path.resolve(__dirname, '../packages/ui/theme/dist/index.js') },
        // Known broken package: route to a harmless stub until implemented
        { find: '@hierarchidb/spreadsheet-plugin', replacement: path.resolve(__dirname, './src/virtual/stubs/spreadsheet-plugin-stub.ts') },
        { find: '@hierarchidb/common-auth', replacement: path.resolve(__dirname, '../packages/common/auth') },
        { find: '@hierarchidb/runtime-worker', replacement: path.resolve(__dirname, '../packages/runtime-worker/worker/dist/index.js') },
        { find: '@hierarchidb/tabular', replacement: path.resolve(__dirname, '../packages/feature/tabular') },
        { find: '@hierarchidb/tag', replacement: path.resolve(__dirname, '../packages/feature/tag') },
        { find: '@hierarchidb/import-export', replacement: path.resolve(__dirname, '../packages/feature/import-export') },
        { find: '@hierarchidb/compute', replacement: path.resolve(__dirname, '../packages/feature/compute') },
        { find: '@hierarchidb/batch', replacement: path.resolve(__dirname, '../packages/feature/batch') },
        { find: '@hierarchidb/download', replacement: path.resolve(__dirname, '../packages/feature/download') },
        { find: '@hierarchidb/map-source', replacement: path.resolve(__dirname, '../packages/feature/map-source') },
        { find: '@hierarchidb/map-view', replacement: path.resolve(__dirname, '../packages/feature/map-view') },
        { find: '@hierarchidb/auth-recovery', replacement: path.resolve(__dirname, '../packages/feature/auth-recovery') },
        // Ensure bootstrap resolves to built JS to avoid importing its UI-provider reexports
        { find: '@hierarchidb/runtime-worker-bootstrap', replacement: path.resolve(__dirname, '../packages/runtime-worker/worker-bootstrap/dist/index.js') },
        { find: '@hierarchidb/feature/feature-registry', replacement: path.resolve(__dirname, '../packages/feature/feature-registry') },
        { find: '@hierarchidb/tabular-xlsx', replacement: path.resolve(__dirname, '../packages/feature/tabular-xlsx') },
        { find: '@hierarchidb/feature-registry', replacement: path.resolve(__dirname, '../packages/feature/feature-registry') },
        // Node-type plugins (resolve to built JS to simplify worker imports)
        { find: '@hierarchidb/folder-plugin', replacement: path.resolve(__dirname, '../packages/node-type/folder-plugin/dist/index.js') },
        { find: '@hierarchidb/basemap-plugin', replacement: path.resolve(__dirname, '../packages/node-type/basemap-plugin/dist/index.js') },
        { find: '@hierarchidb/project-plugin', replacement: path.resolve(__dirname, '../packages/node-type/project-plugin/dist/index.js') },
        { find: '@hierarchidb/shape-plugin', replacement: path.resolve(__dirname, '../packages/node-type/shape-plugin/dist/index.js') },
        { find: '@hierarchidb/styler-plugin', replacement: path.resolve(__dirname, '../packages/node-type/styler-plugin/dist/index.js') },
        { find: '@hierarchidb/route-plugin', replacement: path.resolve(__dirname, '../packages/node-type/route-plugin/dist/index.js') },
        { find: '@hierarchidb/location-plugin', replacement: path.resolve(__dirname, '../packages/node-type/location-plugin/dist/index.js') },
        // パッケージのエイリアスは削除（pnpm workspaceとturbo devで解決）
      ],
    },
    server: {
      port: 4200,
      open: true,
      host: true,
      fs: {
        // Allow serving files from the monorepo root
        allow: [path.resolve(__dirname, '..')],
      },
      // CORS問題を回避するためのプロキシ設定を追加
      /*
      proxy: {
        '/auth': {
          target: 'https://eria-cartograph-bff.kubohiroya.workers.dev',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path, // パスはそのまま維持
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // デバッグ用ログ
              console.log('[Proxy] Redirecting:', req.url, '->', options.target + req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // CORSヘッダーを追加
              proxyRes.headers['access-control-allow-origin'] = 'http://localhost:4200';
              proxyRes.headers['access-control-allow-credentials'] = 'true';
            });
          },
        },
      },
       */
    },
    worker: {
      format: 'es',
      // Apply both comlink and package-reader to worker bundle so virtual modules
      // are available inside the worker context as well.
      plugins: () => [
        comlink(),
        toolsVitePluginPackageReader({
          ...hierarchiDBMultiModulePreset({
            pattern: /@hierarchidb\/(basemap-plugin|project-plugin|folder-plugin|shape-plugin|styler-plugin|route-plugin|location-plugin)$/,
            priorityPlugin: 'folder',
            extractPluginConfig: true,
          }),
          rootDir: path.resolve(__dirname, '..'),
          hooks: {
            beforeTransform: async (packages) => {
              packages.delete('@hierarchidb/spreadsheet-plugin');
              return packages;
            },
            // Worker context: include only plugins that provide a worker entry
            afterTransform: (defs) => {
              try {
                return (defs as any[]).filter((d) => d?.resolvedWorkerImport);
              } catch {
                return defs;
              }
            },
          },
        }),
      ],
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    build: {
      outDir: 'dist',
      // production環境ではソースマップを無効化
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name][extname]',
          ...(isSsrBuild
            ? {}
            : {
                manualChunks: {
                  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                },
              }),
        },
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@mui/icons-material',
        '@emotion/react',
        '@emotion/styled',
      ],
      // @emotion/reactの重複を解決
      exclude: [],
      esbuildOptions: {
        // ビルド時の最適化
        target: 'es2020',
      },
    },
  };
});
