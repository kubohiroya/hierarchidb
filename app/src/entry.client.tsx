import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
// @ts-ignore - React Router v7 export
import { HydratedRouter } from 'react-router/dom';

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});