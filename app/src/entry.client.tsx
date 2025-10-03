import { startTransition, StrictMode } from 'react';
// Dev health overlay (dev only)
if (import.meta.env.DEV) import('./dev-health-client.js');
import { createRoot, hydrateRoot } from 'react-dom/client';
import { initializeDefaultNodeDialogExtensions } from '@hierarchidb/plugins-folder-plugin';
import { HydratedRouter } from 'react-router/dom';

// Do not wrap HydratedRouter with providers here; SSR markup must match exactly.

function removeHydrateFallback(): void {
  document.getElementById('hdb-hydrate-fallback')?.remove();
}

startTransition(() => {
  // Initialize node-type dialog extensions (shape/spreadsheet/basemap/styler) for SSR hydration path as well.
  // No DOM output; safe to run before hydration.
  void initializeDefaultNodeDialogExtensions();
  removeHydrateFallback();
  let container = document.getElementById('root');
  let shouldHydrate = true;
  if (!container) {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
    shouldHydrate = false;
  } else if (!container.hasChildNodes()) {
    // Server markup absent (e.g., SPA preview build). Fall back to client render.
    console.warn('[entry.client] Server markup missing in #root; falling back to client render.');
    shouldHydrate = false;
  }

  const element = (
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );

  if (shouldHydrate) {
    try {
      hydrateRoot(container, element);
      return;
    } catch (error) {
      console.error('[entry.client] hydrateRoot failed; falling back to client render.', error);
    }
  }

  const root = createRoot(container);
  root.render(element);
});
