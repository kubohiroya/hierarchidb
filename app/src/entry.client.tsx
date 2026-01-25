import { RouterProvider } from '@tanstack/react-router';
import { startTransition, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppRoot from './root.js';
import { createHierarchiRouter, getBasePath, getRouterMode } from './router/index.js';
import { initializeBrowserGlobals } from './router/init/initializeBrowserGlobals.ts';
import { preloadPluginWorkerStores } from './worker-runtime/WorkerModuleLoader.js';

/**
 * Initialize and mount the application with TanStack Router
 * Phase 5: React Router has been completely removed
 */
async function initializeApp() {
  initializeBrowserGlobals();
  await preloadPluginWorkerStores();
  const mode = getRouterMode();
  const basename = getBasePath();

  const router = await createHierarchiRouter({
    mode,
    basename,
  });

  return router;
}

function removeHydrateFallback(): void {
  document.getElementById('hdb-hydrate-fallback')?.remove();
}

type BootRouter = Awaited<ReturnType<typeof initializeApp>>;

const BootstrappedApp = () => {
  const [router, setRouter] = useState<BootRouter | null>(null);

  useEffect(() => {
    removeHydrateFallback();
  }, []);

  useEffect(() => {
    let active = true;
    initializeApp()
      .then((nextRouter) => {
        if (!active) return;
        startTransition(() => setRouter(nextRouter));
      })
      .catch((error) => {
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
