import { defineConfig, loadEnv } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { faviconPlugin } from './vite-plugin-favicon';

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild, command }) => {
  // 環境変数を読み込む
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || '';
  // VITE_APP_NAMEが設定されている場合のみbaseを設定
  const base = appName ? `/${appName}/` : '/';
  // const isDev = mode === 'development';

  // プラグインのリストを作成
  const plugins = [
    // tildeResolver(),
    faviconPlugin(), // Add favicon plugin to serve favicon at root
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
      dedupe: ['@emotion/react', '@emotion/styled', 'react', 'react-dom'],
      alias: [
        // ローカルソースのエイリアスのみ
        { find: '~', replacement: path.resolve(__dirname, './src') },
        // パッケージのエイリアスは削除（pnpm workspaceとturbo devで解決）
      ],
    },
    server: {
      port: 4200,
      open: true,
      host: true,
      // CORS問題を回避するためのプロキシ設定を追加
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
          }
        }
      }
    },
    worker: {
      format: 'es',
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
