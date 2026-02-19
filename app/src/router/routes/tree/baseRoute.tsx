/**
 * Base console Route for TanStack Router
 *
 * This route handles the `/t` path and initializes the Worker API client.
 * It corresponds to the React Router route `t.tsx`
 *
 * This route provides worker initialization as a shared barrier for all console-related routes.
 */

import { createRoute, Outlet } from '@tanstack/react-router';
import { loadWorkerAPIClient } from '~/router/loaders/treeLoaders';
import { rootRoute } from '~/router/routes/rootRoute';

type BootWindow = Window & {
  __HDB_INIT_WAIT__?: Promise<void> | null;
  __HDB_INIT_COMPLETE__?: boolean;
};

function getBootWindow(): BootWindow | null {
  if (typeof window === 'undefined') return null;
  return window as BootWindow;
}

export const treeBaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 't',
  shouldReload: false,
  staleTime: Infinity,
  loader: async () => {
    const bootWindow = getBootWindow();

    // Create a shared barrier early so parent/child loaders converge on one wait
    if (bootWindow && !bootWindow.__HDB_INIT_WAIT__) {
      bootWindow.__HDB_INIT_WAIT__ = new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        const handler = () => {
          bootWindow.removeEventListener('hierarchidb-worker-init-complete', handler);
          bootWindow.__HDB_INIT_COMPLETE__ = true;
          finish();
        };
        bootWindow.addEventListener('hierarchidb-worker-init-complete', handler, { once: true });
        const poll = bootWindow.setInterval(() => {
          // Defer to WorkerAPIClient if available
          import('~/worker-runtime/WorkerAPIClient')
            .then(({ WorkerAPIClient }) => {
              if (WorkerAPIClient.isReady()) {
                bootWindow.clearInterval(poll);
                finish();
              }
            })
            .catch(() => {});
        }, 100);
        // Soft cap; child loaders also set their own timeout
        bootWindow.setTimeout(() => {
          bootWindow.clearInterval(poll);
          finish();
        }, 20000);
      });
    }

    const r = await loadWorkerAPIClient();
    return r;
  },
  component: TreeBaseLayout,
});

function TreeBaseLayout() {
  return <Outlet />;
}
