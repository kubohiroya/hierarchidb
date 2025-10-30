import { registerWorkerClientHook, getWorkerClientHook } from '@hierarchidb/feature-core/runtime-client';
import { setGlobalMuiIconMap, toPascalCase } from '@hierarchidb/ui-shell/ui-icon';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType } from 'react';
import { pluginIconLoaders, pluginRegistry } from '~/plugin-registry/index.ts';
import { bootLog } from '../../utils/bootLog.ts';
import { APP_VERSION, BUILD_TIME } from '../../version.ts';
import { loadAllUIPlugins } from '../../services/ui-plugin-loader.ts';
import { useWorkerClient } from '../../contexts/WorkerProvider.js';
import { getInstalledPlugins } from '../../services/plugin-registry.ts';

type TreeConsolePanelGlobal = typeof import('@hierarchidb/ui-shell/ui-treeconsole-base')['TreeConsolePanel'];

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
        //await autoLoadPlugins();
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

  void import('../../WorkerAPIClient.ts').catch((error) => {
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

  void import('@hierarchidb/ui-shell/ui-treeconsole-base')
    .then((mod) => {
      const panel = mod?.TreeConsolePanel as TreeConsolePanelGlobal | undefined;
      if (panel) {
        globalWindow.__HDB_TreeConsolePanel = panel;
      }
    })
    .catch((error) => {
      logWarning('Failed to load TreeConsolePanel for global exposure', error);
    });

  const buildIconMap = async () => {
    const iconMap: Record<string, ComponentType<SvgIconProps>> = {};
    const orderedPlugins = getInstalledPlugins();
    const invalidComponentNodeTypes = new Set<string>();
    const failedLoaderNodeTypes: Array<{ nodeType: string; error: unknown }> = [];

    await Promise.all(
      orderedPlugins.map(async (entry) => {
        const pascal = toPascalCase(entry.nodeType);
        if (!pascal) return;

        const loader = pluginIconLoaders[entry.nodeType];
        if (typeof loader !== 'function') {
          return;
        }

        try {
          const resolved = (await loader()) as unknown;
          const normalized = normalizeToReactComponent(resolved);

          if (normalized) {
            iconMap[pascal] = normalized;
          } else {
            invalidComponentNodeTypes.add(entry.nodeType);
          }
        } catch (error) {
          failedLoaderNodeTypes.push({ nodeType: entry.nodeType, error });
        }
      }),
    );

    setGlobalMuiIconMap(iconMap);

    if (invalidComponentNodeTypes.size > 0) {
      const list = Array.from(invalidComponentNodeTypes).sort().join(', ');
      logWarning(`Icon loader returned an invalid component for: ${list}`);
    }

    if (failedLoaderNodeTypes.length > 0) {
      for (const { nodeType, error } of failedLoaderNodeTypes) {
        logWarning(`Failed to load icon component for "${nodeType}"`, error);
      }
    }
  };

  (globalWindow.__HDB_UI_PLUGIN_READY__ ?? Promise.resolve())
    .then(() => {
      if (globalWindow.__uiPluginsRegistered !== true) {
        return;
      }
      return buildIconMap();
    })
    .catch((error) => {
      logWarning('Failed to initialize MUI icon map', error);
    });

  const prewarmFlag = import.meta.env.VITE_PREWARM_SERVICES;
  const shouldPrewarm = prewarmFlag === '1' || (import.meta.env.PROD && prewarmFlag !== '0');

  if (shouldPrewarm) {
    void import('~/services/databases.js')
      .then(async (db) => {
        const nodeTypes = await db.prewarmPluginDatabases();
        window.dispatchEvent(
          new CustomEvent('hdb-services-ready', {
            detail: { source: 'ui', at: Date.now(), nodeTypes },
          }),
        );
      })
      .catch((error) => {
        logWarning('Failed to prewarm plugin services', error);
      });
  }

  bootLog('Browser globals initialized');
}

function normalizeToReactComponent(value: unknown, seen = new Set<unknown>()): ComponentType<SvgIconProps> | null {
  if (!value) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (typeof value === 'function') {
    return value as ComponentType<SvgIconProps>;
  }

  if (typeof value === 'object') {
    const candidate = value as Record<string, unknown> & { $$typeof?: unknown; render?: unknown; type?: unknown };

    if (typeof candidate.$$typeof === 'symbol' || typeof candidate.render === 'function') {
      return candidate as unknown as ComponentType<SvgIconProps>;
    }

    if (typeof candidate.type === 'function' || typeof candidate.type === 'object') {
      return candidate as unknown as ComponentType<SvgIconProps>;
    }

    if (typeof candidate.default !== 'undefined') {
      const normalized = normalizeToReactComponent(candidate.default, seen);
      if (normalized) return normalized;
    }
  }

  return null;
}
