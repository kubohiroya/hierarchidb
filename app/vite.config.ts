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

  /**
   * HDB_DEV 運用ドキュメント（開発者向け）
   *
   * 目的:
   * - モノレポ配下の UI パッケージを、Vite dev サーバから直接 src を参照して HMR で快適に開発する。
   * - turbo の watch → dist 反映 → Vite で検出、という待ち時間を避け、保存＝即反映にする。
   *
   * 使い方（最小レシピ）:
   * - 環境変数 HDB_DEV に、開発対象ワークスペースパッケージ名をカンマ区切りで指定します。
   *   例:
   *     macOS/Linux (bash/zsh):
   *       HDB_DEV=@hierarchidb/ui-treeconsole-toolbar,@hierarchidb/ui-treeconsole-base pnpm -C app dev
   *     PowerShell:
   *       $env:HDB_DEV="@hierarchidb/ui-treeconsole-toolbar,@hierarchidb/ui-treeconsole-base"; pnpm -C app dev
   *     fish:
   *       env HDB_DEV=@hierarchidb/ui-treeconsole-toolbar,@hierarchidb/ui-treeconsole-base pnpm -C app dev
   *
   * 挙動:
   * - 指定パッケージは resolve.alias で src/index.ts に差し替え、かつ optimizeDeps.exclude に入れて pre-bundle から外します。
   * - これにより、当該パッケージの変更は即 HMR で反映されます。
   *
   * 注意:
   * - HDB_DEV を変更したら Vite を再起動してください（依存最適化キャッシュのため）。
   * - 対象を増やす場合は DEV_SRC_MAP にマッピングを追加してください（パッケージ名 → src エントリ）。
   * - React 重複を避けるため resolve.dedupe を維持しています。
   */
  // Minimal recipe: develop selected workspace UI packages via src with HMR
  // Usage: set HDB_DEV to CSV of package names, e.g.
  //   HDB_DEV=@hierarchidb/ui-treeconsole-toolbar,@hierarchidb/ui-treeconsole-base
  const DEV_PACKAGES = (env.HDB_DEV || process.env.HDB_DEV || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Map active packages to their src entry. Extend here as needed.
  const DEV_SRC_MAP: Record<string, string> = {
    '@hierarchidb/ui-treeconsole-toolbar': '../packages/ui/treeconsole/toolbar/src/index.ts',
    '@hierarchidb/ui-treeconsole-base': '../packages/ui/treeconsole/base/src/index.ts',
    '@hierarchidb/ui-treeconsole-speeddial': '../packages/ui/treeconsole/speeddial/src/index.ts',
    '@hierarchidb/ui-treeconsole-breadcrumb': '../packages/ui/treeconsole/breadcrumb/src/index.ts',
    '@hierarchidb/ui-icon': '../packages/ui/icon/src/index.ts',
    // 追加したいパッケージがあればここにマッピングを足してください
  };

  const devAliases = DEV_PACKAGES
    .map((name) => (DEV_SRC_MAP[name] ? { find: name, replacement: path.resolve(__dirname, DEV_SRC_MAP[name]) } : null))
    .filter(Boolean) as Array<{ find: string; replacement: string }>;

  // Note: Guidance logs are printed by hdb-dev-banner plugin after server starts.

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

  // Print a clear banner AFTER Vite finishes its own startup messages
  const hdbDevBannerPlugin = {
    name: 'hdb-dev-banner',
    configureServer(server: any) {
      const printBanner = (lines: string[]) => {
        const width = Math.max(...lines.map((l) => l.length), 64);
        const bar = '+-' + '-'.repeat(width) + '-+';
        // eslint-disable-next-line no-console
        console.log('\n' + bar);
        for (const l of lines) {
          const pad = ' '.repeat(width - l.length);
          // eslint-disable-next-line no-console
          console.log(`|  ${l}${pad}  |`);
        }
        // eslint-disable-next-line no-console
        console.log(bar + '\n');
      };
      const onListening = () => {
        try {
          if (DEV_PACKAGES.length === 0) {
            printBanner([
              'HDB_DEV is not set.',
              'Tip: Enable instant HMR for workspace UI packages by setting HDB_DEV.',
              'Example:',
              '  HDB_DEV=@hierarchidb/ui-treeconsole-toolbar,@hierarchidb/ui-treeconsole-base pnpm -C app dev',
            ]);
          } else {
            printBanner([
              'HDB_DEV active packages (using src + HMR):',
              ...DEV_PACKAGES.map((p) => `- ${p}`),
            ]);
          }
        } catch {}
      };
      if (server?.httpServer) {
        server.httpServer.once('listening', onListening);
      } else {
        // Fallback: print immediately if httpServer is not available yet
        onListening();
      }
    },
  } as any;

  return {
    base,
    // Avoid clearing the terminal so startup logs (e.g. HDB_DEV tips) remain visible
    clearScreen: false,
    define: (() => {
      // Inject version and build time for logging
      return {
        __APP_VERSION__: JSON.stringify(appVersion),
        __BUILD_TIME__: JSON.stringify(buildTime),
      } as Record<string, string>;
    })(),
    plugins: [buildBeaconPlugin, hdbDevBannerPlugin, ...plugins],
    resolve: {
      // Avoid multiple React copies by always resolving to the app's React
      dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', 'provider', 'provider-dom'],
      alias: [
        { find: '~', replacement: path.resolve(__dirname, './src') },
        // Active dev packages: resolve to src for instant HMR
        ...devAliases,
        // Worker subpath exports — map to src during dev so Vite can resolve without prior builds
        { find: '@hierarchidb/route-plugin/worker', replacement: path.resolve(__dirname, '../packages/node-type/route-plugin/src/worker/index.ts') },
        { find: '@hierarchidb/project-plugin/worker', replacement: path.resolve(__dirname, '../packages/node-type/project-plugin/src/worker/index.ts') },
        { find: '@hierarchidb/location-plugin/worker', replacement: path.resolve(__dirname, '../packages/node-type/location-plugin/src/worker/index.ts') },
        { find: '@hierarchidb/shape-plugin/worker', replacement: path.resolve(__dirname, '../packages/node-type/shape-plugin/src/worker/index.ts') },
        // Icons utility (always point to src for now)
        { find: '@hierarchidb/ui-icon', replacement: path.resolve(__dirname, '../packages/ui/icon/src/index.ts') },
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
        // Ensure bootstrap utils resolve to built dist in app build
        {
          find: '@hierarchidb/runtime-worker-bootstrap',
          replacement: path.resolve(__dirname, '../packages/runtime-worker/worker-bootstrap/dist/index.js'),
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
      plugins: () => [
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
      // Exclude active dev packages from pre-bundle so Vite watches their sources directly
      exclude: DEV_PACKAGES,
      esbuildOptions: {
        target: 'es2020',
      },
    },
  };
});
