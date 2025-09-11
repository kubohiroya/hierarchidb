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
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || '';
  //  VITE_APP_NAMEbase
  const base = appName ? `/${appName}/` : '/';
  // const isDev = mode === 'development';

  //  main thread
  const plugins = [
    // HierarchiDB plugin package discovery -> virtual modules
    toolsVitePluginPackageReader({
      ...hierarchiDBMultiModulePreset({
        //  spreadsheet-plugin
        pattern: /@hierarchidb\/(basemap-plugin|project-plugin|folder-plugin|shape-plugin|styler-plugin|route-plugin|location-plugin)$/,
        priorityPlugin: 'folder',
        extractPluginConfig: true,
      }),
      rootDir: path.resolve(__dirname, '..'),
      hooks: {
        //  transform
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

  // beacon values captured in closure
  const buildTime = new Date().toISOString();
  let appVersion = '0.0.0-dev';
  try {
    const pkgPath = path.resolve(__dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    if (pkg?.version) appVersion = pkg.version;
  } catch {}

  const buildBeaconPlugin = {
    name: 'hdb-build-beacon',
    configureServer(server: any) {
      const startedAt = new Date().toISOString();
      server.middlewares.use('/__hdb_build.json', (_req: any, res: any) => {
        const payload = {
          appVersion,
          buildTime,
          serverStartedAt: startedAt,
          pid: process.pid,
          cwd: process.cwd(),
        };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      });
    },
  } as any;

  return {
    base,
    define: (() => {
      // Inject version and build time for logging
      return {
        __APP_VERSION__: JSON.stringify(appVersion),
        __BUILD_TIME__: JSON.stringify(buildTime),
      } as Record<string, string>;
    })(),
    plugins: [buildBeaconPlugin, ...plugins],
    resolve: {
      // Avoid multiple React copies by always resolving to the app's React
      dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', 'provider', 'provider-dom'],
      alias: [
        { find: '~', replacement: path.resolve(__dirname, './src') },
        // Virtual modules are provided by tools-vite-plugin-package-reader.
        { find: 'crypto', replacement: path.resolve(__dirname, './src/virtual/crypto-shim.ts') },
        // Some transitive libs (e.g., loaders.gl worker-utils) reference Node's child_process.
        // Stub it for browser builds to avoid __vite-browser-external resolution errors.
        { find: 'child_process', replacement: path.resolve(__dirname, './src/virtual/child-process-shim.ts') },
        // Legacy provider alias used by some plugins
        { find: 'provider-i18next', replacement: 'react-i18next' },
        // Ensure worker bundle can resolve @hierarchidb/runtime-worker from plugin dist
        // We point to the built dist to let Vite trace its internal worker entry (stageWorker.entry.js)
        {
          find: '@hierarchidb/runtime-worker',
          replacement: path.resolve(__dirname, '../packages/runtime-worker/worker/dist/index.js'),
        },
        // Temporary workspace alias: ensure Vite resolves @hierarchidb/batch used by plugins
        // Rationale: location-plugin bundles it as external; alias points to built dist
        // Temporary aliases removed after dynamic imports hardened
        // Note: do not alias workspace packages; rely on declared deps and workspace linking
        // Known broken package: route to a harmless stub until implemented
        {
          find: '@hierarchidb/spreadsheet-plugin',
          replacement: path.resolve(__dirname, './src/virtual/stubs/spreadsheet-plugin-stub.ts'),
        },
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
      // Dev proxy for BFF endpoints
      proxy: {
        '/auth': {
          target: env.VITE_BFF_BASE_URL || 'http://localhost:8787',
          changeOrigin: true,
          secure: true,
        },
      },
    },
    worker: {
      format: 'es',
      // Apply both comlink and package-reader to worker bundle so virtual modules
      // are available inside the worker context as well.
      plugins: [
        // Run package-reader first so virtual modules are available early
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
            // Do not auto-import plugin-specific worker bundles here.
            // Runtime wiring now handles worker adapters centrally via @hierarchidb/runtime-worker.
          },
        }),
        comlink(),
      ],
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    build: {
      outDir: 'dist',
      //  production
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
    // Prevent Vite/React Router SSR build from externalizing workspace packages,
    // which would otherwise cause runtime failures when loaded in the browser.
    ssr: {
      noExternal: [/^@hierarchidb\//],
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
      //  @emotion/react
      exclude: [],
      esbuildOptions: {
        target: 'es2020',
      },
    },
  };
});
