import { startTransition, StrictMode } from 'react';
if (import.meta.env.DEV) import('./dev-health-client.js');
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { initializeDefaultNodeDialogExtensions } from '@hierarchidb/plugins-folder-plugin';
import { AppProviders } from './router/context/AppProviders.js';
import {
  createHierarchiRouter,
  getRouterMode,
  getBasePath,
} from './router/index.js';

/**
 * Initialize and mount the application with TanStack Router
 * Phase 5: React Router has been completely removed
 */
async function initializeApp() {
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

    createRoot(rootElement).render(
      <StrictMode>
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>
      </StrictMode>,
    );
  });
});
