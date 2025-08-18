import { StrictMode, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

// HashRouter用のエントリーポイント
// GitHub Pages等の静的ホスティング環境用

const router = createHashRouter(routes);

startTransition(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element not found');
  
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
});