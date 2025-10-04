import { startTransition } from 'react';
if (import.meta.env.DEV) import('./dev-health-client.js');
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { initializeDefaultNodeDialogExtensions } from '@hierarchidb/plugins-folder-plugin';
import {
  createHierarchiRouter,
  getRouterMode,
  getBasePath,
} from './router/index.js';
import { initializeBrowserGlobals } from './router/init/initializeBrowserGlobals.js';

/**
 * Initialize and mount the application with TanStack Router
 * Phase 5: React Router has been completely removed
 */
async function initializeApp() {
  initializeBrowserGlobals();
  await initializeDefaultNodeDialogExtensions();
  const mode = getRouterMode();
  const basename = getBasePath();

  const router = createHierarchiRouter({
    mode,
    basename,
  });

  return router;
}

function removeHydrateFallback(): void {
  document.getElementById('hdb-hydrate-fallback')?.remove();
}

initializeApp().then((router) => {
  startTransition(() => {
    let rootElement = document.getElementById('root');
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }

    removeHydrateFallback();

    createRoot(rootElement).render(<RouterProvider router={router} />);
  });
});
