import { RouterProvider } from '@tanstack/react-router';
import { startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { registerAuthUIHandlers } from '@hierarchidb/ui-plugin-shell/ui-auth';
import { createHierarchiRouter, getBasePath, getRouterMode } from './router/index.js';
import type { AppRouterInstance } from './router/index.js';
import AppRoot from './root.js';
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

  registerAuthRecoveryHandlers(router);

  return router;
}

function removeHydrateFallback(): void {
  document.getElementById('hdb-hydrate-fallback')?.remove();
}

function getAccessTokenFromStorage(): string | null {
  return (
    sessionStorage.getItem('access_token') ||
    localStorage.getItem('access_token')
  );
}

async function waitForAccessToken(timeoutMs = 2 * 60 * 1000): Promise<string> {
  const existing = getAccessTokenFromStorage();
  if (existing) return existing;

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const interval = window.setInterval(() => {
      const token = getAccessTokenFromStorage();
      if (token) {
        window.clearInterval(interval);
        resolve(token);
        return;
      }
      if (Date.now() >= deadline) {
        window.clearInterval(interval);
        reject(new Error('Authentication timeout'));
      }
    }, 1000);
  });
}

function registerAuthRecoveryHandlers(router: AppRouterInstance) {
  registerAuthUIHandlers(async (_notification) => {
    const token = getAccessTokenFromStorage();
    if (token) {
      return {
        token,
        type: 'Bearer',
        expiresAt: Date.now() + 60 * 60 * 1000,
      };
    }

    const location = router.state.location;
    const pathname = location?.pathname ?? window.location.pathname;
    const search = location?.search ?? window.location.search;
    const hash = location?.hash ?? window.location.hash;
    const returnPath = `${pathname}${search}${hash}`;

    sessionStorage.setItem('auth.returnUrl', returnPath);
    localStorage.setItem('auth_return_url', returnPath);
    localStorage.setItem('bff-auth-redirect-url', returnPath);
    if (!pathname.startsWith('/auth/login')) {
      void router.navigate({
        to: '/auth/login',
        state: { from: { pathname: returnPath } },
      });
    }

    const refreshed = await waitForAccessToken();
    return {
      token: refreshed,
      type: 'Bearer',
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  });
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
      <AppRoot>
        <RouterProvider router={router} />
      </AppRoot>
    );
  });
});
