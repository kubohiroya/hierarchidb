import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { initializeShapeDB } from '@hierarchidb/shape-store';
import { getWorkerClientHook, registerWorkerClientHook } from '@hierarchidb/ui-worker-provider';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { useWorker } from '~/contexts/WorkerProvider';
import { initializeMaintenanceChannel } from '~/maintenance/maintenanceChannelConstants';
import { pluginRegistry } from '~/plugin-loaders/index';
import { bootLog } from '~/utils/bootLog';
import { APP_VERSION, BUILD_TIME } from '~/versionConstants';

type TreeConsolePanelGlobal = typeof import('@hierarchidb/ui-treeconsole-base')['TreeConsolePanel'];

type BrowserGlobals = Window & {
  __uiPluginsRegistered?: boolean;
  __HDB_UI_PLUGIN_READY__?: Promise<void>;
  __HDB_TreeConsolePanel?: TreeConsolePanelGlobal;
  __HDB_MENU_BUILDERS__?: unknown;
  __HDB_PLUGIN_DEFS__?: unknown[];
  __HDB_APP_BASE__?: string;
  __HDB_GET_WORKER_CLIENT_HOOK?: ReturnType<typeof getWorkerClientHook>;
  __HDB_DEBUG_DUMP__?: (options?: { limit?: number }) => Promise<unknown[]>;
  __HDB_DEBUG_CLEAR__?: () => Promise<void>;
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

type DebugLogRecord = {
  id?: number;
  ts?: number;
  level?: string;
  tag?: string;
  message?: string;
  dataText?: string;
};

const openDebugLogDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB is not available'));
      return;
    }
    const request = indexedDB.open(
      getDBName(getBuildDatabasePrefix(), 'debug-log'),
      1
    );
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open debug log DB'));
  });
};

const readDebugLogs = async (limit: number): Promise<DebugLogRecord[]> => {
  const db = await openDebugLogDb();
  return new Promise((resolve, reject) => {
    const logs: DebugLogRecord[] = [];
    const tx = db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const request = store.openCursor(null, 'prev');
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || logs.length >= limit) {
        resolve(logs.slice().reverse());
        return;
      }
      logs.push(cursor.value as DebugLogRecord);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to read debug logs'));
    tx.oncomplete = () => {
      db.close();
    };
    tx.onerror = () => {
      db.close();
    };
  });
};

const clearDebugLogs = async (): Promise<void> => {
  const db = await openDebugLogDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to clear debug logs'));
    tx.oncomplete = () => {
      db.close();
    };
    tx.onerror = () => {
      db.close();
    };
  });
};

export function initializeBrowserGlobals(): void {
  if (initialized) return;

  const databasePrefix = getBuildDatabasePrefix();
  initializeEphemeralDB(getDBName(databasePrefix, 'ephemeral'));
  initializeShapeDB(getDBName(databasePrefix, 'shape'));
  initialized = true;

  initializeMaintenanceChannel();
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
  globalWindow.__HDB_APP_BASE__ = import.meta.env.BASE_URL || '/';
  globalWindow.__HDB_GET_WORKER_CLIENT_HOOK = getWorkerClientHook;
  globalWindow.__HDB_DEBUG_DUMP__ = async (options?: { limit?: number }) => {
    const limit = typeof options?.limit === 'number' ? options.limit : 2000;
    try {
      const logs = await readDebugLogs(limit);
      console.log('[HDB][DebugLog] dump', logs);
      return logs;
    } catch (error) {
      console.warn('[HDB][DebugLog] dump failed', error);
      return [];
    }
  };
  globalWindow.__HDB_DEBUG_CLEAR__ = async () => {
    try {
      await clearDebugLogs();
      console.log('[HDB][DebugLog] cleared');
    } catch (error) {
      console.warn('[HDB][DebugLog] clear failed', error);
    }
  };

  void globalWindow.__HDB_UI_PLUGIN_READY__?.catch(() => {
    /* swallow to avoid unhandled rejection */
  });

  void import('~/worker-runtime/WorkerAPIClient').catch((error) => {
    console.error('[browser-globals] Failed to load WorkerAPIClient module:', error);
  });

  void import('~/plugin-loaders/menu-builders')
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
      logWarning('menu-builders preload failed (will fallback to worker plugin-loaders)', error);
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
        label: manifest.displayName ?? manifest.name ?? entry.nodeType,
        manifest: {
          ...manifest,
          icon,
        },
        createOrder: typeof manifest.priority === 'number' ? manifest.priority : undefined,
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
    void import('~/plugin-runtime/databaseUtils')
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
