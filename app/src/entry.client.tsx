import { startTransition, StrictMode } from 'react';
// Dev health overlay (dev only)
if (import.meta.env.DEV) import('./dev-health-client.js');
import { hydrateRoot } from 'react-dom/client';
import { initializeDefaultNodeDialogExtensions } from '@hierarchidb/plugins-folder-plugin';
import { HydratedRouter } from 'react-router/dom';

// Do not wrap HydratedRouter with providers here; SSR markup must match exactly.

startTransition(() => {
  // Initialize node-type dialog extensions (shape/spreadsheet/basemap/styler) for SSR hydration path as well.
  // No DOM output; safe to run before hydration.
  void initializeDefaultNodeDialogExtensions();
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
