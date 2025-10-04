import { startTransition, StrictMode, useEffect } from 'react';
if (import.meta.env.DEV) import('./dev-health-client.js');
import { createRoot } from 'react-dom/client';
import type { RouteObject } from 'react-router-dom';
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from 'react-router-dom';
import { RouterProvider as TanStackRouterProvider } from '@tanstack/react-router';
import routes from './routes.js';
import { initializeDefaultNodeDialogExtensions } from '@hierarchidb/plugins-folder-plugin';
import { AppProviders } from './router/context/AppProviders.js';
import {
  createHierarchiRouter,
  getRouterMode,
  getBasePath,
} from './router/index.js';

type RouterMode = 'browser' | 'hash';
type RouterEngine = 'react-router' | 'tanstack';

const ROUTER_MODE: RouterMode =
  (import.meta.env.VITE_ROUTER_MODE?.toLowerCase() as RouterMode | undefined) ?? 'browser';

const ROUTER_ENGINE: RouterEngine =
  (import.meta.env.VITE_ROUTER_ENGINE?.toLowerCase() as RouterEngine | undefined) ?? 'react-router';

function getBasePath_Legacy(): string {
  const base = import.meta?.env?.BASE_URL ?? '/';
  if (typeof base !== 'string') return '/';
  return base.endsWith('/') ? base.slice(0, -1) || '/' : base;
}

async function createAppRouter() {
  const resolvedRoutes = (await routes) as unknown as RouteObject[];
  await initializeDefaultNodeDialogExtensions();
  const basePath = getBasePath_Legacy();

  if (ROUTER_MODE === 'hash') {
    if (
      basePath !== '/' &&
      location.pathname.startsWith(basePath) &&
      !location.hash
    ) {
      const rest = location.pathname.slice(basePath.length);
      const normalized = `/${rest}`.replace(/\/+/, '/');
      location.replace(`${basePath}#${normalized}${location.search}`);
    }
    return createHashRouter(resolvedRoutes);
  }

  return createBrowserRouter(resolvedRoutes, {
    basename: basePath === '/' ? undefined : basePath,
  });
}

async function createTanStackRouter() {
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

async function initializeApp() {
  if (ROUTER_ENGINE === 'tanstack') {
    return { engine: 'tanstack' as const, router: await createTanStackRouter() };
  }
  return { engine: 'react-router' as const, router: await createAppRouter() };
}

initializeApp().then(({ engine, router }) => {
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
          {engine === 'tanstack' ? (
            <TanStackRouterProvider router={router} />
          ) : (
            <RouterProvider router={router} />
          )}
        </AppProviders>
      </StrictMode>,
    );
  });
});
