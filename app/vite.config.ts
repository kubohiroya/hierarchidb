import { defineConfig, loadEnv } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';
import * as fs from 'node:fs';
import * as path from 'path';
import { readFileSync } from 'node:fs';
import { faviconPlugin } from './vite-plugin-favicon.js';
import { comlink } from 'vite-plugin-comlink';
import { visualizer } from 'rollup-plugin-visualizer';
import { createNodeTypeAliasPlugin } from '@hierarchidb/vite-plugin-hierarchidb-plugin-alias';
import { generatePluginRegistry } from '../scripts/generate-plugin-loader.mjs';

type AliasEntry = { find: string; replacement: string };

interface RuntimeAliasConfig {
  aliases: AliasEntry[];
  optimizeDepsExclude: string[];
}

function createRuntimeAliasConfig({
  rootDir,
  isDev,
}: {
  rootDir: string;
  isDev: boolean;
}): RuntimeAliasConfig {
  const aliases: AliasEntry[] = [];
  const optimizeExclude = new Set<string>(['@hierarchidb/runtime-client']);

  const addAlias = (specifier: string, relativePath: string | null, { exclude = false } = {}) => {
    if (!relativePath) return;
    const absolutePath = path.resolve(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    aliases.push({ find: specifier, replacement: absolutePath });
    if (exclude) optimizeExclude.add(specifier);
  };

  if (isDev) {
    addAlias('@hierarchidb/runtime-worker', '../packages/runtime/worker/src/index.ts', { exclude: true });
    addAlias('@hierarchidb/runtime-client', '../packages/runtime/client/src/index.ts', { exclude: true });
    addAlias('@hierarchidb/map-adapter', '../packages/feature/map-adapter/src/index.ts', { exclude: true });
    addAlias('@hierarchidb/tabular-source-xlsx', '../packages/feature/tabular-source-xlsx/src/index.ts', { exclude: true });

    const pluginRoot = path.resolve(rootDir, '../packages/plugin-loader');
    if (fs.existsSync(pluginRoot)) {
      const workerCandidates = ['src/worker/factory/index.ts', 'src/worker-factory/index.ts', 'src/worker-factory.ts'];
      const uiCandidates = ['src/ui/index.ts', 'src/ui.ts'];

      for (const entry of fs.readdirSync(pluginRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (!entry.name.endsWith('-plugin')) continue;

        const pluginName = entry.name;
        const specBase = `@hierarchidb/${pluginName}`;

        const resolveCandidate = (candidates: string[]) => {
          for (const candidate of candidates) {
            const resolved = path.resolve(rootDir, `../packages/plugins/${pluginName}/${candidate}`);
            if (fs.existsSync(resolved)) return `../packages/plugins/${pluginName}/${candidate}`;
          }
          return null;
        };

        const workerRel = resolveCandidate(workerCandidates);
        if (workerRel) {
          addAlias(`${specBase}/worker-factory`, workerRel, { exclude: true });
        }

        const uiRel = resolveCandidate(uiCandidates);
        if (uiRel) {
          addAlias(`${specBase}/ui`, uiRel, { exclude: true });
        }
      }
    }
  } else {
    addAlias('@hierarchidb/runtime-worker', '../packages/runtime/worker/dist/index.js');
    addAlias('@hierarchidb/runtime-client', '../packages/runtime/client/dist/index.js');
    addAlias('@hierarchidb/map-adapter', '../packages/feature/map-adapter/dist/index.ts', { exclude: true });
    addAlias('@hierarchidb/tabular-source-xlsx', '../packages/feature/tabular-source-xlsx/dist/index.ts', { exclude: true });
  }

  return {
    aliases,
    optimizeDepsExclude: Array.from(optimizeExclude),
  };
}

const pluginManifestWatchPattern = new RegExp(
  `${path.sep}plugins${path.sep}[^${path.sep}]+-plugin${path.sep}(package.json|src${path.sep}plugin-manifest.ts|src${path.sep}extension${path.sep}plugin-manifest.ts)$`,
);

let pluginRegistryGenerationQueue: Promise<unknown> = Promise.resolve();

function enqueuePluginRegistryGeneration() {
  pluginRegistryGenerationQueue = pluginRegistryGenerationQueue
    .then(() => generatePluginRegistry())
    .catch((error) => {
      console.error('[plugin-registry-generator] Failed to regenerate registry', error);
    });
  return pluginRegistryGenerationQueue;
}

function pluginRegistryGeneratorPlugin({ rootDir }: { rootDir?: string } = {}): Plugin {
  const resolvedRoot = rootDir ? path.resolve(rootDir) : path.resolve(__dirname, '..');
  const appPackagePath = path.resolve(resolvedRoot, 'app', 'package.json');

  const shouldTrigger = (file: string): boolean => {
    const normalized = path.resolve(file);
    return normalized === appPackagePath || pluginManifestWatchPattern.test(normalized);
  };

  return {
    name: 'hierarchidb:plugin-registry-generator',
    async configResolved() {
      await enqueuePluginRegistryGeneration();
    },
    configureServer(server) {
      const schedule = (file: string) => {
        if (shouldTrigger(file)) {
          void enqueuePluginRegistryGeneration();
        }
      };
      server.watcher.on('add', schedule);
      server.watcher.on('change', schedule);
    },
    async handleHotUpdate(ctx) {
      if (shouldTrigger(ctx.file)) {
        await enqueuePluginRegistryGeneration();
      }
      return undefined;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prefer VITE_APP_PREFIX if provided; otherwise default to root '/'
  const appPrefix = (env.VITE_APP_PREFIX || env.VITE_APP_NAME || '').replace(/^\/+|\/+$/g, '');
  const base = appPrefix ? `/${appPrefix}/` : '/';
  const isDev = mode === 'development';

  const ssrExternalDeps = ['@mui/material', '@mui/system', '@mui/utils', 'node-fetch', 'whatwg-url', 'tr46'];

  const runtimeAliasConfig = createRuntimeAliasConfig({ rootDir: __dirname, isDev });

  // Note: Guidance logs are printed by hdb-dev-banner plugin after server starts.

  //  main thread
  const plugins = [
    pluginRegistryGeneratorPlugin({
      rootDir: path.resolve(__dirname, '..'),
    }),
    createNodeTypeAliasPlugin({
      rootDir: path.resolve(__dirname, '..'),
    }),
    /*
    devHealthPlugin({
      // Ignore virtual/server-only or known peer-provided modules to avoid false positives
      ignore: [
        '@emotion/react',
        'react-hook-geolocation',
        'comlink',
        'isbot',
        // Provided as app deps but sometimes hoisted/resolved at root in monorepo
        'react-resizable',
        'react-draggable',
      ],
    }),
     */
    // HierarchiDB plugin package discovery -> virtual modules
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

  if (process.env.DEBUG_WORKER_HMR === '1') {
    console.log('[vite.config] main plugin order', plugins.map((p) => p && (p as any).name));
  }

  // beacon values captured in closure
  const buildTime = new Date().toISOString();
  let appVersion = '0.0.0-dev';
  try {
    const pkgPath = path.resolve(__dirname, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    if (pkg?.version) appVersion = pkg.version;
  } catch {
    // no-op: fallback to default version when package.json is not accessible
  }

  const buildBeaconPlugin: Plugin = {
    name: 'hdb-build-beacon',
    configureServer(server: ViteDevServer) {
      const startedAt = new Date().toISOString();
      const beaconHandler = (_req: XMLHttpRequest, res: any) => {
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
      const handler = async (req: any, res: any, next: any) => {
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
            // body: rawBody,
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
          const body = resp.body;
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

  return {
    base,
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
    plugins: [buildBeaconPlugin, hdbDevProxyPlugin, ...plugins],
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
        // Ensure a single instance for plugin dialog runtime across app and plugin-loader
        '@hierarchidb/runtime-ui-plugin-dialog',
      ],
      alias: [
        { find: '~', replacement: path.resolve(__dirname, './src') },
        // Force ESM/modern entrypoints for MUI to avoid SSR CJS 'require is not defined'
        // These aliases are safe across v5/v7 as they point to ESM builds.
        // Do not alias MUI packages to ESM entry files.
        // Aliasing to index.ts breaks subpath imports like '@mui/system/Grid'
        // which would resolve to '.../esm/index.ts/Grid' and fail.
        // Active dev packages: resolve to src for instant HMR
        //...devAliases,
        ...runtimeAliasConfig.aliases,
        // Ensure runtime-ui-plugin-dialog can resolve peer @hierarchidb/ui-core during app build
        { find: '@hierarchidb/ui-core', replacement: path.resolve(__dirname, '../packages/ui/core/dist/index.ts') },
        // Icons utility (always point to src for now)
        { find: '@hierarchidb/ui-icon', replacement: path.resolve(__dirname, '../packages/ui/icon/src/index.ts') },
        // Unify plugin-dialog runtime to a single module instance to avoid split singletons
        { find: '@hierarchidb/runtime-ui-plugin-dialog', replacement: path.resolve(__dirname, '../packages/plugin-ui-sdk/dist/index.js') },
        // Base plugin is an internal helper library; if it accidentally appears in a virtual import,
        // make it resolvable to its built output to avoid dev server crashes.
        { find: '@hierarchidb/base-plugin', replacement: path.resolve(__dirname, '../packages/plugin-loader/base-plugin/dist/index.ts') },
        // Virtual modules are provided by @hierarchidb/vite-plugin-hierarchidb-plugin-alias.
        { find: 'crypto', replacement: path.resolve(__dirname, './src/virtual/crypto-shim.ts') },
        // Some transitive libs (e.g., loaders.gl worker-utils) reference Node's child_process.
        // Stub it for browser builds to avoid __vite-browser-external resolution errors.
        { find: 'child_process', replacement: path.resolve(__dirname, './src/virtual/child-process-shim.ts') },
        // Legacy provider alias used by some plugin-loader
        { find: 'provider-i18next', replacement: 'react-i18next' },
        // Temporary workspace alias: ensure Vite resolves @hierarchidb/batch used by plugin-loader
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
      plugins: () => [
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
      // MapLibre GL and Deck.gl ship together in map.js; allow a larger warning threshold.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        external: [
          // Peer deps referenced by workspace libs (ui-dialog) that should resolve from app
          'react-resizable',
          'react-draggable',
          // Prevent bundling plugin database entry points; they stay lazy-loaded via plugin loader
          '@hierarchidb/basemap-plugin/database',
          '@hierarchidb/resolver-plugin/database',
          '@hierarchidb/route-plugin/database',
          '@hierarchidb/spreadsheet-plugin/database',

        ],
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name][extname]',
          ...(isSsrBuild
            ? {}
            : {
              manualChunks: {
                'vendor-react': ['react', 'react-dom'],
              },
            }),
        },
        onwarn(warning, warn) {
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
            typeof warning.message === 'string' &&
            warning.message.includes('"use client"')
          ) {
            return;
          }
          warn(warning);
        },
      },
    },
    // Prevent Vite SSR build from externalizing workspace packages,
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
        'dexie',
        'react-resizable',
        'react-draggable',
        '@mui/material',
        '@mui/icons-material',
        '@emotion/react',
        '@emotion/styled',
      ],
      // Exclude specific packages from pre-bundle so Vite watches sources directly
      exclude: runtimeAliasConfig.optimizeDepsExclude,
      esbuildOptions: {
        target: 'es2020',
      },
    },
  };
});
