import {
  getOriginCoordinatorSourceSha,
  ORIGIN_COORDINATOR_ACTIVE_WORKER_TIMEOUT_MS,
  ORIGIN_COORDINATOR_DATABASE_NAME,
  ORIGIN_COORDINATOR_MESSAGE_TIMEOUT_MS,
  ORIGIN_COORDINATOR_SCRIPT_NAME,
  revokeOriginCoordinatorOwnedClientHandles,
} from '@hierarchidb/origin-coordinator';
import { revokeLegacyYamlAccessAndClose } from '@hierarchidb/yaml-store';
import { RouterProvider } from '@tanstack/react-router';
import { startTransition, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeOriginCoordinator } from './origin-coordinator/initializeOriginCoordinator.js';
import { runOriginCoordinatorGatedBootstrap } from './origin-coordinator/runOriginCoordinatorGatedBootstrap.js';
import type { OriginCoordinatorClientHandle } from './origin-coordinator/types.js';
import { clearAppIndexedDBsViaPlugins } from './plugin-runtime/clearIndexedDbUtils.ts';
import AppRoot from './root.js';
import { createHierarchiRouter, getBasePath, getRouterMode } from './router/index.js';
import { initializeBrowserGlobals } from './router/init/initializeBrowserGlobals.ts';
import {
  relayOriginCoordinatorSharedWorkerRequest,
  revokeRuntimeWorkerAccessAndClose,
} from './worker-runtime/clientUtils.js';
import { preloadPluginWorkerStores } from './worker-runtime/workerModuleLoaderUtils.js';

type HydrateLoader = {
  setProgress: (progress: number, message?: string) => void;
  maxProgress?: number;
};

type HydrateLoaderWindow = Window & {
  __HDB_HYDRATE_LOADER__?: HydrateLoader;
  __HDB_ORIGIN_COORDINATOR_REF__?: OriginCoordinatorClientHandle;
};

const HYDRATE_FALLBACK_ID = 'hdb-hydrate-fallback';
const HYDRATE_MESSAGE_ID = 'hdb-hydrate-progress-message';
const HYDRATE_RECOVERY_CONTAINER_ID = 'hdb-hydrate-recovery-container';
const HYDRATE_RECOVERY_STATUS_ID = 'hdb-hydrate-recovery-status';

const setHydrateProgress = (progress: number, message?: string): void => {
  if (typeof window === 'undefined') return;
  const loader = (window as HydrateLoaderWindow).__HDB_HYDRATE_LOADER__;
  loader?.setProgress(progress, message);
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return String(error);
};

const shouldOfferIndexedDbReset = (error: unknown): boolean => {
  const message = toErrorMessage(error);
  return (
    message.includes('UpgradeError') || message.includes('Not yet support for changing primary key')
  );
};

const deleteNamedDatabase = (name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to delete database: ${name}`));
    request.onblocked = () => reject(new Error(`Delete blocked for database: ${name}`));
  });

const clearIndexedDbViaBrowserApi = async (): Promise<string[]> => {
  if (
    typeof window === 'undefined' ||
    !('indexedDB' in window) ||
    typeof indexedDB.databases !== 'function'
  ) {
    return [];
  }

  const databases = await indexedDB.databases();
  const names = databases
    .map((db) => db.name)
    .filter(
      (name): name is string =>
        typeof name === 'string' && name.length > 0 && name !== ORIGIN_COORDINATOR_DATABASE_NAME
    );
  for (const name of names) {
    await deleteNamedDatabase(name);
  }
  return names;
};

const getHydrateStatusNode = (): HTMLDivElement | null => {
  const status = document.getElementById(HYDRATE_RECOVERY_STATUS_ID);
  return status instanceof HTMLDivElement ? status : null;
};

const setHydrateStatus = (message: string): void => {
  const status = getHydrateStatusNode();
  if (status) {
    status.textContent = message;
  }
};

const renderIndexedDbResetControls = (initialMessage: string): void => {
  if (typeof window === 'undefined') return;
  const fallback = document.getElementById(HYDRATE_FALLBACK_ID);
  if (!(fallback instanceof HTMLDivElement)) return;

  const existing = document.getElementById(HYDRATE_RECOVERY_CONTAINER_ID);
  if (existing instanceof HTMLDivElement) {
    setHydrateStatus(initialMessage);
    return;
  }

  const messageNode = document.getElementById(HYDRATE_MESSAGE_ID);
  if (messageNode instanceof HTMLDivElement) {
    messageNode.textContent = initialMessage;
  }

  const container = document.createElement('div');
  container.id = HYDRATE_RECOVERY_CONTAINER_ID;
  container.style.marginTop = '16px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.gap = '12px';

  const actionButton = document.createElement('button');
  actionButton.type = 'button';
  actionButton.id = 'hdb-db-reset-reload-button';
  actionButton.textContent = 'DB初期化して再読み込み';
  actionButton.setAttribute('aria-label', 'DB初期化して再読み込み');
  actionButton.style.padding = '8px 14px';
  actionButton.style.border = '1px solid #1976d2';
  actionButton.style.borderRadius = '8px';
  actionButton.style.background = '#1976d2';
  actionButton.style.color = '#ffffff';
  actionButton.style.fontSize = '13px';
  actionButton.style.cursor = 'pointer';

  const status = document.createElement('div');
  status.id = HYDRATE_RECOVERY_STATUS_ID;
  status.style.textAlign = 'center';
  status.style.whiteSpace = 'pre-line';
  status.style.color = 'rgba(0, 0, 0, 0.68)';
  status.style.fontFamily = "Roboto, 'Helvetica Neue', Arial, sans-serif";
  status.style.fontSize = '12px';
  status.textContent = initialMessage;

  actionButton.onclick = async () => {
    actionButton.disabled = true;
    actionButton.style.opacity = '0.7';
    actionButton.style.cursor = 'default';
    setHydrateStatus('Deleting IndexedDBs and reloading...');

    const failureMessages: string[] = [];
    try {
      const result = await clearAppIndexedDBsViaPlugins();
      if (result.errors.length > 0) {
        const summary = result.errors
          .map((entry) => `${entry.nodeType}: ${toErrorMessage(entry.error)}`)
          .join('; ');
        failureMessages.push(summary);
      }
    } catch (error) {
      failureMessages.push(toErrorMessage(error));
    }

    try {
      await clearIndexedDbViaBrowserApi();
    } catch (error) {
      failureMessages.push(toErrorMessage(error));
    }

    if (failureMessages.length > 0) {
      setHydrateStatus(
        [
          'Automatic reset failed.',
          `Reason: ${failureMessages[0]}`,
          'Please close other tabs using this app and manually delete IndexedDB, then reload.',
        ].join('\n')
      );
      actionButton.disabled = false;
      actionButton.style.opacity = '1';
      actionButton.style.cursor = 'pointer';
      return;
    }

    setHydrateStatus('IndexedDBs deleted. Reloading...');
    window.location.reload();
  };

  container.appendChild(actionButton);
  container.appendChild(status);
  fallback.appendChild(container);
};

/**
 * Initialize and mount the application with TanStack Router
 * Phase 5: React Router has been completely removed
 */
async function initializeApp() {
  setHydrateProgress(0, 'Preparing client bootstrap...');
  const appBase = import.meta.env.BASE_URL;
  const coordinatorScriptPath = import.meta.env.DEV
    ? `${appBase}src/origin-coordinator/originCoordinator.worker.ts`
    : `${appBase}${ORIGIN_COORDINATOR_SCRIPT_NAME}`;
  const router = await runOriginCoordinatorGatedBootstrap({
    initializeCoordinator: () =>
      initializeOriginCoordinator({
        releaseId: getOriginCoordinatorSourceSha(),
        registrationUrl: new URL(coordinatorScriptPath, window.location.origin).href,
        scope: new URL(appBase, window.location.origin).href,
        activeWorkerTimeoutMs: ORIGIN_COORDINATOR_ACTIVE_WORKER_TIMEOUT_MS,
        messageTimeoutMs: ORIGIN_COORDINATOR_MESSAGE_TIMEOUT_MS,
        relaySharedWorkerRequest: relayOriginCoordinatorSharedWorkerRequest,
        revokeLegacyYamlAccess: async () => {
          let closeFailed = false;
          try {
            revokeRuntimeWorkerAccessAndClose();
          } catch {
            closeFailed = true;
          }
          try {
            await revokeOriginCoordinatorOwnedClientHandles();
          } catch {
            closeFailed = true;
          }
          try {
            revokeLegacyYamlAccessAndClose();
          } catch {
            closeFailed = true;
          }
          if (closeFailed) throw new Error('window-quiescence-close-failed');
        },
      }),
    acceptCoordinator: (coordinator) => {
      (window as HydrateLoaderWindow).__HDB_ORIGIN_COORDINATOR_REF__ = coordinator;
      setHydrateProgress(6, 'Origin coordinator ready');
    },
    initializeBrowserGlobals: () => {
      initializeBrowserGlobals();
      setHydrateProgress(11, 'Browser globals initialized');
    },
    preloadWorkerStores: async () => {
      await preloadPluginWorkerStores();
      setHydrateProgress(22, 'Preloading worker stores');
    },
    initializeRuntime: async () => {
      const mode = getRouterMode();
      const basename = getBasePath();
      return await createHierarchiRouter({ mode, basename });
    },
  });
  setHydrateProgress(33, 'Client bootstrap complete');

  return router;
}

function removeHydrateFallback(): void {
  document.getElementById('hdb-hydrate-fallback')?.remove();
}

type BootRouter = Awaited<ReturnType<typeof initializeApp>>;

const BootstrappedApp = () => {
  const [router, setRouter] = useState<BootRouter | null>(null);

  useEffect(() => {
    let active = true;
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!active) return;
      if (!shouldOfferIndexedDbReset(event.reason)) return;
      setHydrateProgress(33, 'IndexedDB schema upgrade failed.');
      renderIndexedDbResetControls(
        'Detected IndexedDB schema mismatch (primary key change).\n「DB初期化して再読み込み」を実行してください。'
      );
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);

    initializeApp()
      .then((nextRouter) => {
        if (!active) return;
        removeHydrateFallback();
        startTransition(() => setRouter(nextRouter));
      })
      .catch((error) => {
        setHydrateProgress(33, 'Client bootstrap failed. Check console.');
        if (shouldOfferIndexedDbReset(error)) {
          renderIndexedDbResetControls(
            'Detected IndexedDB schema mismatch (primary key change).\n「DB初期化して再読み込み」を実行してください。'
          );
        }
        console.error('[entry.client] initializeApp failed', error);
      });
    return () => {
      active = false;
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return <AppRoot>{router ? <RouterProvider router={router} /> : null}</AppRoot>;
};

let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

createRoot(rootElement).render(<BootstrappedApp />);
