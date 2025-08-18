import { StrictMode, startTransition } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

startTransition(() => {
  // Check if we're in SPA mode (no SSR)
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    // SPA mode - use createRoot
    createRoot(root).render(
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    );
  } else {
    // SSR mode - use hydrateRoot
    hydrateRoot(
      document,
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    );
  }
});
