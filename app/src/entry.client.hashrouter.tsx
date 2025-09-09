import { startTransition, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { RouteObject } from 'react-router-dom';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import routes from './routes';

//  HashRouter
//  GitHub Pages

async function createApp() {
  const resolvedRoutes = await routes;
  // flatRoutes() provides RouteConfig entries; cast to RouteObject[] for client router
  return createHashRouter(resolvedRoutes as unknown as RouteObject[]);
}

createApp().then((router) => {
  startTransition(() => {
    const root = document.getElementById('root');
    if (!root) throw new Error('Root element not found');

    createRoot(root).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  });
});
