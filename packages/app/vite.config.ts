import { defineConfig, loadEnv } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 環境変数を読み込む
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || '';
  // VITE_APP_NAMEが設定されている場合のみbaseを設定
  const base = appName ? `/${appName}/` : '/';

  const isDev = mode === 'development';

  return {
    base,
    plugins: [
      reactRouter(),
      tsconfigPaths({
        projects: ['./tsconfig.json'],
        ignoreConfigErrors: true,
      }),
    ],
    resolve: {
      alias: [
        // appの~エイリアス
        { find: /^~(?!.*node_modules)/, replacement: path.resolve(__dirname, './app') },
        // パッケージエイリアス
        { find: '@', replacement: path.resolve(__dirname, './src') },
        // Core packages always use dist for stability
        { find: '@hierarchidb/core', replacement: path.resolve(__dirname, '../core/dist') },
        { find: '@hierarchidb/api', replacement: path.resolve(__dirname, '../api/dist') },
        { find: '@hierarchidb/worker', replacement: path.resolve(__dirname, '../worker/dist') },
        // UI packages use src in development for HMR, dist in production
        { find: '@hierarchidb/ui-core', replacement: path.resolve(__dirname, isDev ? '../ui-core/src' : '../ui-core/dist') },
        {
          find: '@hierarchidb/ui-client',
          replacement: path.resolve(__dirname, isDev ? '../ui-client/src' : '../ui-client/dist'),
        },
        { find: '@hierarchidb/ui-auth', replacement: path.resolve(__dirname, isDev ? '../ui-auth/src' : '../ui-auth/dist') },
        { find: '@hierarchidb/ui-i18n', replacement: path.resolve(__dirname, isDev ? '../ui-i18n/src' : '../ui-i18n/dist') },
        {
          find: '@hierarchidb/ui-layout',
          replacement: path.resolve(__dirname, isDev ? '../ui-layout/src' : '../ui-layout/dist'),
        },
        {
          find: '@hierarchidb/ui-navigation',
          replacement: path.resolve(__dirname, isDev ? '../ui-navigation/src' : '../ui-navigation/dist'),
        },
        {
          find: '@hierarchidb/ui-routing',
          replacement: path.resolve(__dirname, isDev ? '../ui-routing/src' : '../ui-routing/dist'),
        },
        { find: '@hierarchidb/ui-tour', replacement: path.resolve(__dirname, isDev ? '../ui-tour/src' : '../ui-tour/dist') },
        { find: '@hierarchidb/ui-file', replacement: path.resolve(__dirname, isDev ? '../ui-file/src' : '../ui-file/dist') },
        {
          find: '@hierarchidb/ui-monitoring',
          replacement: path.resolve(__dirname, isDev ? '../ui-monitoring/src' : '../ui-monitoring/dist'),
        },
        // Plugins always use dist for stability
        {
          find: '@hierarchidb/plugin-basemap',
          replacement: path.resolve(__dirname, '../plugins/basemap/dist'),
        },
        {
          find: '@hierarchidb/plugin-shapes',
          replacement: path.resolve(__dirname, '../plugins/shapes/dist'),
        },
        {
          find: '@hierarchidb/plugin-stylemap',
          replacement: path.resolve(__dirname, '../plugins/stylemap/dist'),
        },
      ],
    },
    server: {
      port: 4200,
      open: true,
      host: true,
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
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-mui': [
              '@mui/material',
              '@mui/icons-material',
              '@emotion/react',
              '@emotion/styled',
            ],
          },
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
    },
    define: {
      'import.meta.env.VITE_AUTH_AUTHORITY': JSON.stringify(process.env.VITE_AUTH_AUTHORITY || ''),
      'import.meta.env.VITE_AUTH_CLIENT_ID': JSON.stringify(process.env.VITE_AUTH_CLIENT_ID || ''),
      'import.meta.env.VITE_AUTH_REDIRECT_URI': JSON.stringify(
        process.env.VITE_AUTH_REDIRECT_URI || ''
      ),
      'import.meta.env.VITE_AUTH_SCOPE': JSON.stringify(process.env.VITE_AUTH_SCOPE || ''),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || ''),
    },
  };
});
