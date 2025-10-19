import type { ComponentType } from 'react';
import { registerWorkerClientHook, getWorkerClientHook } from '@hierarchidb/runtime-client';
import { setGlobalMuiIconMap } from '@hierarchidb/ui-icon';
import { bootLog } from '../../utils/bootLog.js';
import { APP_VERSION, BUILD_TIME } from '../../version.js';
import { loadAllUIPlugins } from '../../generated/ui-loader.js';
import { useWorkerClient } from '../../contexts/WorkerProvider.js';
import { autoLoadPlugins } from '~/plugin-loader/auto-load.js';

type TreeConsolePanelGlobal = typeof import('@hierarchidb/ui-treeconsole-base')['TreeConsolePanel'];

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

  registerWorkerClientHook(useWorkerClient);

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

  if (!globalWindow.__HDB_UI_PLUGIN_READY__) {
    globalWindow.__HDB_UI_PLUGIN_READY__ = (async () => {
      try {
        await loadAllUIPlugins();
        await autoLoadPlugins();
        globalWindow.__uiPluginsRegistered = true;
      } catch (error) {
        globalWindow.__uiPluginsRegistered = false;
        logWarning('Failed to register UI plugin-loader', error);
        throw error;
      }
    })();
  }

  void globalWindow.__HDB_UI_PLUGIN_READY__?.catch(() => {
    /* swallow to avoid unhandled rejection */
  });

  void import('../../WorkerAPIClient.js').catch((error) => {
    console.error('[browser-globals] Failed to load WorkerAPIClient module:', error);
  });

  void import('~/plugin-loader/menu-builders.js')
    .then(async (mod) => {
      (globalWindow as Window & { __HDB_MENU_BUILDERS__?: unknown }).__HDB_MENU_BUILDERS__ = mod;
      try {
        await (mod as { prefetchIconsForAllContexts?: () => Promise<void> }).prefetchIconsForAllContexts?.();
      } catch (error) {
        logWarning('Prefetching icon contexts failed', error);
      }
    })
    .catch((error) => {
      logWarning('menu-builders preload failed (will fallback to worker plugin-loader)', error);
    });

  void import('virtual:plugin-definitions')
    .then((mod: { default?: unknown[] }) => {
      globalWindow.__HDB_PLUGIN_DEFS__ = mod?.default || [];
    })
    .catch((error) => {
      logWarning('Failed to load virtual:plugin-definitions', error);
    });

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

  void import('virtual:mui-icon-map')
    .then((mod: { default?: Record<string, ComponentType<any>>; iconMap?: Record<string, ComponentType<any>> }) => {
      const map = (mod.default || mod.iconMap || {}) as Record<string, ComponentType<any>>;
      setGlobalMuiIconMap(map);
    })
    .catch((error) => {
      logWarning('Failed to load virtual:mui-icon-map', error);
    });

  if (import.meta.env.VITE_PREWARM_SERVICES === '1') {
    void import('~/services/databases.js')
      .then(async (db) => {
        const safeOpen = async (
          label: string,
          database: { open?: () => Promise<unknown> } | undefined,
        ): Promise<string> => {
          try {
            await database?.open?.();
          } catch (error) {
            logWarning(`Prewarm database open failed for ${label}`, error);
          }
          return label;
        };

        const results = await Promise.allSettled([
          db.getBaseMapDatabase().then(async (d) => safeOpen('basemap', d)),
          db.getResolverDB().then(async (d) => safeOpen('resolver', d)),
          db.getSpreadsheetDatabase().then(async (d) => safeOpen('spreadsheet', d)),
          db.getRouteDatabase().then(async (d) => safeOpen('route', d)),
          db.getShapeDatabase().then(async (d) => safeOpen('shape', d)),
          db.getLocationEphemeralDB().then(async (d) => safeOpen('location', d)),
        ]);
        const ok = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map((r) => r.value);

        window.dispatchEvent(
          new CustomEvent('hdb-services-ready', {
            detail: { source: 'ui', at: Date.now(), nodeTypes: ok },
          }),
        );
      })
      .catch((error) => {
        logWarning('Failed to prewarm plugin services', error);
      });
  }

  bootLog('Browser globals initialized');
}
