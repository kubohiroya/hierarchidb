import { RouterProvider } from '@tanstack/react-router';
import { startTransition, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppRoot from './root.js';
import { createHierarchiRouter, getBasePath, getRouterMode } from './router/index.js';
import { initializeBrowserGlobals } from './router/init/initializeBrowserGlobals.ts';
import { preloadPluginWorkerStores } from './worker-runtime/WorkerModuleLoader.js';

type HydrateLoader = {
  setProgress: (progress: number, message?: string) => void;
  maxProgress?: number;
};

type HydrateLoaderWindow = Window & {
  __HDB_HYDRATE_LOADER__?: HydrateLoader;
};

const setHydrateProgress = (progress: number, message?: string): void => {
  if (typeof window === 'undefined') return;
  const loader = (window as HydrateLoaderWindow).__HDB_HYDRATE_LOADER__;
  loader?.setProgress(progress, message);
};

/**
 * Initialize and mount the application with TanStack Router
 * Phase 5: React Router has been completely removed
 */
async function initializeApp() {
  setHydrateProgress(0, 'Preparing client bootstrap...');
  initializeBrowserGlobals();
  setHydrateProgress(11, 'Browser globals initialized');
  await preloadPluginWorkerStores();
  setHydrateProgress(22, 'Preloading worker stores');
  const mode = getRouterMode();
  const basename = getBasePath();

  const router = await createHierarchiRouter({
    mode,
    basename,
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
    initializeApp()
      .then((nextRouter) => {
        if (!active) return;
        removeHydrateFallback();
        startTransition(() => setRouter(nextRouter));
      })
      .catch((error) => {
        setHydrateProgress(33, 'Client bootstrap failed. Check console.');
        console.error('[entry.client] initializeApp failed', error);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppRoot>
      {router ? <RouterProvider router={router} /> : null}
    </AppRoot>
  );
};

let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

createRoot(rootElement).render(<BootstrappedApp />);
