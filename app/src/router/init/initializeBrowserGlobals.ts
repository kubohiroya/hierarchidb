import { getWorkerClientHook, registerWorkerClientHook } from '@hierarchidb/ui-worker-provider';
import { pluginRegistry } from '~/plugin-registry/index.ts';
import { useWorker } from '../../contexts/WorkerProvider.js';
import { bootLog } from '../../utils/bootLog.ts';
import { APP_VERSION, BUILD_TIME } from '../../version.ts';

type TreeConsolePanelGlobal =
  typeof import('@hierarchidb/ui-treeconsole-base')['TreeConsolePanel'];

type BrowserGlobals = Window & {
  __uiPluginsRegistered?: boolean;
  __HDB_UI_PLUGIN_READY__?: Promise<void>;
  __HDB_TreeConsolePanel?: TreeConsolePanelGlobal;
  __HDB_MENU_BUILDERS__?: unknown;
  __HDB_PLUGIN_DEFS__?: unknown[];
  __HDB_GET_WORKER_CLIENT_HOOK?: ReturnType<typeof getWorkerClientHook>;
};

const logWarning = (message: string, error?: unknown) => {
  if (typeof console === 'undefined') {
    return;
  }
  if (typeof error === 'undefined') {
    console.warn('[browser-globals]', message);
  } else {
    console.warn('[browser-globals]', message, error);
  }
};

let initialized = false;

export function initializeBrowserGlobals(): void {
  if (initialized) return;
  initialized = true;

  registerWorkerClientHook(useWorker);

  const localBuildTime = (() => {
    try {
      return new Date(BUILD_TIME).toLocaleString();
    } catch (error) {
      logWarning('Failed to format BUILD_TIME', error);
      return String(BUILD_TIME);
    }
  })();
  console.log(`[App] Version: ${APP_VERSION} | Build Time (local): ${localBuildTime}`);

  if (typeof window === 'undefined') {
    return;
  }

  const globalWindow = window as BrowserGlobals;
  globalWindow.__HDB_GET_WORKER_CLIENT_HOOK = getWorkerClientHook;

  void globalWindow.__HDB_UI_PLUGIN_READY__?.catch(() => {
    /* swallow to avoid unhandled rejection */
  });

  void import('../../worker-runtime/WorkerAPIClient.ts').catch((error) => {
    console.error('[browser-globals] Failed to load WorkerAPIClient module:', error);
  });

  void import('~/plugin-loader/menu-builders.js')
    .then(async (mod) => {
      (globalWindow as Window & { __HDB_MENU_BUILDERS__?: unknown }).__HDB_MENU_BUILDERS__ = mod;
      try {
        await (
          mod as { prefetchIconsForAllContexts?: () => Promise<void> }
        ).prefetchIconsForAllContexts?.();
      } catch (error) {
        logWarning('Prefetching icon contexts failed', error);
      }
    })
    .catch((error) => {
      logWarning('menu-builders preload failed (will fallback to worker plugin-loader)', error);
    });

  try {
    const defsForUi = pluginRegistry.map((entry) => {
      const manifest = entry.manifest ?? {};
      const icon = manifest.icon ?? undefined;
      const extendsValue = manifest.extends ?? (manifest as { base?: string })?.base;
      return {
        nodeType: entry.nodeType,
        name: manifest.name ?? entry.packageName,
        packageName: entry.packageName,
        version: manifest.version ?? entry.version,
        config: {
          displayName: manifest.displayName ?? manifest.name ?? entry.nodeType,
          name: manifest.name ?? entry.packageName,
          description: manifest.description,
          priority: manifest.priority,
          icon,
          extends: extendsValue,
          base: (manifest as { base?: string })?.base,
          category: manifest.category,
        },
      };
    });
    globalWindow.__HDB_PLUGIN_DEFS__ = defsForUi;
  } catch (error) {
    logWarning('Failed to initialize plugin definitions from registry', error);
  }

  void import('@hierarchidb/ui-treeconsole-base')
    .then((mod) => {
      const panel = mod?.TreeConsolePanel as TreeConsolePanelGlobal | undefined;
      if (panel) {
        globalWindow.__HDB_TreeConsolePanel = panel;
      }
    })
    .catch((error) => {
      logWarning('Failed to load TreeConsolePanel for global exposure', error);
    });

  const prewarmFlag = import.meta.env.VITE_PREWARM_SERVICES;
  const shouldPrewarm = prewarmFlag === '1' || (import.meta.env.PROD && prewarmFlag !== '0');

  if (shouldPrewarm) {
    void import('~/plugin-host/databases.js')
      .then(async (db) => {
        const nodeTypes = await db.prewarmPluginDatabases();
        window.dispatchEvent(
          new CustomEvent('hdb-services-ready', {
            detail: { source: 'ui', at: Date.now(), nodeTypes },
          })
        );
      })
      .catch((error) => {
        logWarning('Failed to prewarm plugin services', error);
      });
  }

  bootLog('Browser globals initialized');
}

// Icon map initialization is handled by AppIconRegistryProvider at runtime-worker.
