import { defineConfig, loadEnv } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
// @ts-ignore
import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import * as fs from 'fs';
import { faviconPlugin } from './vite-plugin-favicon.js';
import { comlink } from 'vite-plugin-comlink';
import devHealthPlugin from '@hierarchidb/tools-vite-plugin-dev-health';
import { muiIconsVirtualModule } from './vite-plugin-mui-icons.js';
import { muiIconMapPlugin } from './vite-plugin-mui-icon-map.js';
import { visualizer } from 'rollup-plugin-visualizer';
import { pluginRegistryPlugin } from './vite-plugin-plugin-registry.js';
import { pluginServicesRegistry } from './vite-plugin-plugin-services.js';
import { createNodeTypeAliasPlugin } from '@hierarchidb/tools-plugin-registry-utils';
import {
  vitePluginPackageReader as toolsVitePluginPackageReader,
} from '@hierarchidb/tools-vite-plugin-package-reader';
import { hierarchiDBMultiModulePreset } from '@hierarchidb/tools-vite-plugin-package-reader/presets';

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prefer VITE_APP_PREFIX if provided; otherwise default to root '/'
  const appPrefix = (env.VITE_APP_PREFIX || env.VITE_APP_NAME || '').replace(/^\/+|\/+$/g, '');
  const base = appPrefix ? `/${appPrefix}/` : '/';
  // const isDev = mode === 'development';

  const ssrExternalDeps = ['maplibre-gl', '@mui/material', '@mui/system', '@mui/utils', 'node-fetch', 'whatwg-url', 'tr46'];

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
    '@hierarchidb/ui-treeconsole-breadcrumb': '../packages/ui/treeconsole/breadcrumb/src/index.ts',
    '@hierarchidb/ui-treeconsole-treetable': '../packages/ui/treeconsole/treetable/src/index.ts',
    '@hierarchidb/ui-icon': '../packages/ui/icon/src/index.ts',
    '@hierarchidb/ui-dialog': '../packages/ui/dialog/src/index.ts',
    // Node-type plugins (opt-in via HDB_DEV)
    '@hierarchidb/plugins-resolver-plugin': '../packages/plugins/resolver-plugin/src/index.ts',
    '@hierarchidb/plugins-linker-plugin': '../packages/plugins/linker-plugin/src/index.ts',
    // 追加したいパッケージがあればここにマッピングを足してください
  };

  const devAliases = DEV_PACKAGES
    .map((name) => (DEV_SRC_MAP[name] ? { find: name, replacement: path.resolve(__dirname, DEV_SRC_MAP[name]) } : null))
    .filter(Boolean) as Array<{ find: string; replacement: string }>;

  // Note: Guidance logs are printed by hdb-dev-banner plugin after server starts.

  //  main thread
  const plugins = [
    muiIconsVirtualModule(),
    muiIconMapPlugin({ rootDir: path.resolve(__dirname, '..') }),
    pluginRegistryPlugin({ rootDir: path.resolve(__dirname, '..') }),
    createNodeTypeAliasPlugin({
      rootDir: path.resolve(__dirname, '..'),
      tsconfigPath: path.resolve(__dirname, 'tsconfig.json'),
      tsconfigSubpaths: ['services', 'database'],
    }),
    createNodeTypeAliasPlugin({
      rootDir: path.resolve(__dirname, '..'),
      tsconfigPath: path.resolve(__dirname, 'tsconfig.typecheck.json'),
      tsconfigSubpaths: ['services', 'database'],
    }),
    pluginServicesRegistry({ rootDir: path.resolve(__dirname, '..') }),
    devHealthPlugin({
      // Ignore virtual/server-only or known peer-provided modules to avoid false positives
      ignore: [
        /@react-router\//,
        'react-router',
        'react-router-dom',
        '@emotion/react',
        'react-hook-geolocation',
        'comlink',
        'isbot',
        // Provided as app deps but sometimes hoisted/resolved at root in monorepo
        'react-resizable',
        'react-draggable',
      ],
    }),
    // Use default react-router plugin; let it infer basename from Vite base
    reactRouter(),
    // HierarchiDB plugin package discovery -> virtual modules
    toolsVitePluginPackageReader({
      ...hierarchiDBMultiModulePreset({
        // Include all node-type plugins used in menus
        pattern: /@hierarchidb\/plugins-(basemap|linker|folder|shape|styler|route|location|spreadsheet|resolver|timeline)-plugin$/,
        priorityPlugin: 'folder',
        extractPluginConfig: true,
      }),
      rootDir: path.resolve(__dirname, '..'),
      hooks: {
        //  transform
        beforeTransform: async (packages) => {
          // Do not exclude spreadsheet-plugin: allow menu/icon metadata (emoji) to surface in SpeedDial
          return packages;
        },
      },
    }),
    // Generate d.ts only when explicitly enabled (apps usually don't need it)
    ...(env.VITE_APP_DTS === 'true'
      ? [
          dts({
            outDir: isSsrBuild ? 'build/server-types' : 'build/client-types',
            rollupTypes: false,
            insertTypesEntry: false,
            copyDtsFiles: true,
          }),
        ]
      : []),
    faviconPlugin(), // Add favicon plugin to serve favicon at root
    comlink(), // Add Comlink plugin for Worker support
    tsconfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ];

  const enableVisualizer = (env.VITE_APP_ANALYZE || process.env.HDB_ANALYZE || process.env.BUNDLE_ANALYZE || '')
    .toString()
    .toLowerCase() === 'true';
  if (enableVisualizer) {
    const suffix = isSsrBuild ? 'server' : 'client';
    const analysisDir = path.resolve(__dirname, 'build-analysis');
    plugins.push(
      visualizer({
        filename: path.join(analysisDir, `bundle-visualizer-${suffix}.html`),
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        emitFile: false,
        // ssr: isSsrBuild,
      }),
    );
  }

  // beacon values captured in closure
  const buildTime = new Date().toISOString();
  let appVersion = '0.0.0-dev';
  try {
    const pkgPath = path.resolve(__dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    if (pkg?.version) appVersion = pkg.version;
  } catch {
    // no-op: fallback to default version when package.json is not accessible
  }

  const buildBeaconPlugin: Plugin = {
    name: 'hdb-build-beacon',
    configureServer(server: ViteDevServer) {
      const startedAt = new Date().toISOString();
      const beaconHandler = (_req, res) => {
        const payload = {
          appVersion,
          buildTime,
          serverStartedAt: startedAt,
          pid: process.pid,
          cwd: process.cwd(),
        };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      };
      server.middlewares.use('/__hdb_build.json', beaconHandler);
    },
  };

  // Simple dev-time CORS-bypass proxy via query param (?url=...)
  const hdbDevProxyPlugin: Plugin = {
    name: 'hdb-dev-proxy',
    configureServer(server: ViteDevServer) {
      const handler = async (req, res, next) => {
        try {
          // Allow only localhost callers
          const remote = (req.socket?.remoteAddress || '').toString();
          const forwardedHeader = req.headers['x-forwarded-for'];
          const forwarded = (Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader || '').split(',')[0].trim();
          const hostHeader = (req.headers['host'] || '').toString();
          const isLocalAddr = (addr: string) => !!addr && (
            addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
          );
          const isLocalHostHeader = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostHeader);
          const isLocal = isLocalAddr(remote) || isLocalAddr(forwarded) || isLocalHostHeader;
          if (!isLocal) {
            res.statusCode = 403;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'forbidden', message: 'Proxy is restricted to localhost' }));
            return;
          }

          const origin = (req.headers['origin'] || '').toString();
          const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

          // Parse target URL from query
          const u = new URL(req.url ?? '', 'http://localhost');
          const target = u.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing url query parameter' }));
            return;
          }
          let targetUrl: URL;
          try {
            targetUrl = new URL(target);
          } catch {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid url' }));
            return;
          }
          if (!/^https?:$/.test(targetUrl.protocol)) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'Only http/https are allowed' }));
            return;
          }

          // Handle CORS preflight early if the proxy endpoint is called cross-origin during dev
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            if (isLocalOrigin) res.setHeader('access-control-allow-origin', origin);
            res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS');
            res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || '*');
            res.end();
            return;
          }

          // Collect request body (for POST/PUT/PATCH)
          const getBody = async (): Promise<Buffer> => new Promise((resolve) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', () => resolve(Buffer.alloc(0)));
          });

          const method = req.method || 'GET';
          const rawBody = method === 'GET' || method === 'HEAD' ? undefined : await getBody();

          // Forward headers, dropping hop-by-hop and origin-specific ones
          const fwdHeaders = new Headers();
          const drop = new Set(['host', 'connection', 'content-length', 'accept-encoding', 'referer', 'origin']);
          for (const [k, v] of Object.entries(req.headers)) {
            if (!v) continue;
            const key = k.toLowerCase();
            if (drop.has(key)) continue;
            // Handle multi-value headers
            if (Array.isArray(v)) {
              for (const vv of v) fwdHeaders.append(key, vv);
            } else {
              fwdHeaders.set(key, String(v));
            }
          }
          if (rawBody && !fwdHeaders.has('content-type') && req.headers['content-type']) {
            fwdHeaders.set('content-type', String(req.headers['content-type']));
          }

          const resp = await fetch(targetUrl, {
            method,
            headers: fwdHeaders,
            body: rawBody,
            redirect: 'manual',
          });

          // Relay status and headers
          res.statusCode = resp.status;
          resp.headers.forEach((value, key) => {
            // Skip security headers that may conflict in dev context
            if (/^content-security-policy/i.test(key)) return;
            res.setHeader(key, value);
          });
          // Allow browser clients to read headers; restrict to localhost origins
          if (isLocalOrigin) res.setHeader('access-control-allow-origin', origin);
          res.setHeader('access-control-expose-headers', '*');

          // Stream body if possible
          const body: ReadableStream<Uint8Array> = resp.body;
          if (body) {
            const { Readable } = await import('node:stream');
            Readable.fromWeb(body as any).pipe(res);
          } else {
            const buf = Buffer.from(await resp.arrayBuffer());
            res.end(buf);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Proxy error', message }));
          next?.(err as Error);
        }
      };

      // Mount at both fixed and base-prefixed paths for convenience
      const paths = ['/hierarchidb/proxy', `${base.replace(/\/$/, '')}/proxy`];
      for (const p of Array.from(new Set(paths))) {
        server.middlewares.use(p, handler);
      }
    },
  };

  // Print a clear banner AFTER Vite finishes its own startup messages
  const hdbDevBannerPlugin: Plugin = {
    name: 'hdb-dev-banner',
    configureServer(server: ViteDevServer) {
      const printBanner = (lines: string[]) => {
        const width = Math.max(...lines.map((l) => l.length), 64);
        const bar = '+-' + '-'.repeat(width) + '-+';
        console.log('\n' + bar);
        for (const l of lines) {
          const pad = ' '.repeat(width - l.length);
          console.log(`|  ${l}${pad}  |`);
        }
        console.log(bar + '\n');
      };
      const onListening = () => {

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

      };
      if (server?.httpServer) {
        server.httpServer.once('listening', onListening);
      } else {
        // Fallback: print immediately if httpServer is not available yet
        onListening();
      }
    },
  };

  return {
    base,
    // Avoid clearing the terminal so startup logs (e.g. HDB_DEV tips) remain visible
    clearScreen: false,
    define: (() => {
      // Inject version and build time for logging
      return {
        __APP_VERSION__: JSON.stringify(appVersion),
        __BUILD_TIME__: JSON.stringify(buildTime),
        // Expose selected non-VITE_ envs for client/runtime packages that check them
        'import.meta.env.HDB_LOCAL_PROXY': JSON.stringify(env.HDB_LOCAL_PROXY || process.env.HDB_LOCAL_PROXY || ''),
      } as Record<string, string>;
    })(),
    plugins: [buildBeaconPlugin, hdbDevProxyPlugin, hdbDevBannerPlugin, ...plugins],
    resolve: {
      // Avoid multiple React copies by always resolving to the app's React
      dedupe: [
        'react',
        'react-dom',
        'jotai',
        '@emotion/react',
        '@emotion/styled',
        'provider',
        'provider-dom',
        // Ensure a single instance for plugin dialog runtime across app and plugins
        '@hierarchidb/runtime-ui-plugin-dialog',
      ],
      alias: [
        { find: '~', replacement: path.resolve(__dirname, './src') },
        // Active dev packages are resolved above via HDB_DEV -> devAliases
        // Force ESM/modern entrypoints for MUI to avoid SSR CJS 'require is not defined'
        // These aliases are safe across v5/v7 as they point to ESM builds.
        // Do not alias MUI packages to ESM entry files.
        // Aliasing to index.js breaks subpath imports like '@mui/system/Grid'
        // which would resolve to '.../esm/index.js/Grid' and fail.
        // Active dev packages: resolve to src for instant HMR
        ...devAliases,
        // Ensure runtime-ui-plugin-dialog can resolve peer @hierarchidb/ui-core during app build
        { find: '@hierarchidb/ui-core', replacement: path.resolve(__dirname, '../packages/ui/core/dist/index.js') },
        // Icons utility (always point to src for now)
        { find: '@hierarchidb/ui-icon', replacement: path.resolve(__dirname, '../packages/ui/icon/src/index.ts') },
        // Unify plugin-dialog runtime to a single module instance to avoid split singletons
        { find: '@hierarchidb/runtime-ui-plugin-dialog', replacement: path.resolve(__dirname, '../packages/runtime-ui/plugin-dialog/src/index.ts') },
        // Base plugin is an internal helper library; if it accidentally appears in a virtual import,
        // make it resolvable to its built output to avoid dev server crashes.
        { find: '@hierarchidb/plugins-base-plugin', replacement: path.resolve(__dirname, '../packages/plugins/base-plugin/dist/index.js') },
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
        // Provide UI/Worker registries and icon map in worker context, too
        pluginRegistryPlugin({ rootDir: path.resolve(__dirname, '..') }),
        // Run package-reader first so virtual modules are available early
        toolsVitePluginPackageReader({
          ...hierarchiDBMultiModulePreset({
            pattern: /@hierarchidb\/plugins-(basemap|linker|folder|shape|styler|route|location|spreadsheet|resolver|timeline)-plugin$/,
            priorityPlugin: 'folder',
            extractPluginConfig: true,
          }),
          rootDir: path.resolve(__dirname, '..'),
          hooks: {
            beforeTransform: async (packages) => packages,
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
        external: [
          // Peer deps referenced by workspace libs (ui-dialog) that should resolve from app
          'react-resizable',
          'react-draggable',
        ],
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
      external: ssrExternalDeps,
      // Keep workspace and Emotion packages bundled; maplibre/MUI are externalized above.
      noExternal: [/^@hierarchidb\//, /^@emotion\//],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'dexie',
        'react-resizable',
        'react-draggable',
        '@mui/material',
        '@mui/icons-material',
        '@emotion/react',
        '@emotion/styled',
      ],
      // Exclude specific packages from pre-bundle so Vite watches sources directly
      exclude: [
        // Do not prebundle bootstrap; resolve via alias to dist at build time
        '@hierarchidb/runtime-worker-bootstrap',
        ...DEV_PACKAGES,
      ],
      esbuildOptions: {
        target: 'es2020',
      },
    },
  };
});
