import { defineConfig, loadEnv } from 'vite';
// @ts-ignore
import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import * as path from 'path';
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

  // プラグインのリストを作成
  const plugins = [
    // HierarchiDB plugin package discovery -> virtual modules
    toolsVitePluginPackageReader({
      ...hierarchiDBMultiModulePreset({
        // 現在の命名規則（@hierarchidb/*-plugin）に合わせる
        pattern: /@hierarchidb\/.*-plugin$/,
        priorityPlugin: 'folder',
        extractPluginConfig: true,
      }),
      // モノレポのルートを明示して検出を安定化
      rootDir: path.resolve(__dirname, '..'),
    }),
    dts(),
    faviconPlugin(), // Add favicon plugin to serve favicon at root
    comlink(), // Add Comlink plugin for Worker support
    reactRouter(),
    tsconfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ];

  return {
    base,
    plugins,
    resolve: {
      // @emotion/reactとreactの重複を解決
      dedupe: ['@emotion/react', '@emotion/styled', 'provider', 'provider-dom'],
      alias: [
        // ローカルソースのエイリアスのみ
        { find: '~', replacement: path.resolve(__dirname, './src') },
        // Fallback for virtual module when plugin isn't active in some build modes
        { find: 'virtual:plugin-definitions', replacement: path.resolve(__dirname, './src/virtual/plugin-definitions.ts') },
        { find: 'crypto', replacement: path.resolve(__dirname, './src/virtual/crypto-shim.ts') },
        { find: 'virtual:plugin-map', replacement: path.resolve(__dirname, './src/virtual/plugin-map.ts') },
        // ワークスペース解決が不安定な場合の保険（Rollup の解決を安定化）
        { find: '@hierarchidb/ui-core', replacement: path.resolve(__dirname, '../packages/ui/core') },
        { find: '@hierarchidb/ui-dialog', replacement: path.resolve(__dirname, '../packages/ui/dialog/src/index.ts') },
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
        { find: '@hierarchidb/runtime-worker', replacement: path.resolve(__dirname, '../packages/runtime-worker/worker/src/index.ts') },
        { find: '@hierarchidb/runtime-worker-bootstrap', replacement: path.resolve(__dirname, '../packages/runtime-worker/worker-bootstrap') },
        { find: '@hierarchidb/feature/feature-registry', replacement: path.resolve(__dirname, '../packages/feature/feature-registry') },
        { find: '@hierarchidb/tabular-xlsx', replacement: path.resolve(__dirname, '../packages/feature/tabular-xlsx') },
        { find: '@hierarchidb/feature-registry', replacement: path.resolve(__dirname, '../packages/feature/feature-registry') },
        // パッケージのエイリアスは削除（pnpm workspaceとturbo devで解決）
      ],
    },
    server: {
      port: 4200,
      open: true,
      host: true,
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
      plugins: () => [comlink()],
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
