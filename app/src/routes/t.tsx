import { Outlet } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router';
import { loadWorkerAPIClient, type LoadWorkerAPIClientReturn } from '~/loader.js';

type BootWindow = Window & {
  __HDB_INIT_WAIT__?: Promise<void> | null;
  __HDB_INIT_COMPLETE__?: boolean;
};

function getBootWindow(): BootWindow | null {
  if (typeof window === 'undefined') return null;
  return window as BootWindow;
}

export async function clientLoader(_args: LoaderFunctionArgs): Promise<LoadWorkerAPIClientReturn> {
  const bootWindow = getBootWindow();

  // Create a shared barrier early so parent/child loaders converge on one wait
  if (bootWindow && !bootWindow.__HDB_INIT_WAIT__) {
    bootWindow.__HDB_INIT_WAIT__ = new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const handler = () => {
        bootWindow.removeEventListener('hierarchidb-worker-init-complete', handler);
        bootWindow.__HDB_INIT_COMPLETE__ = true;
        finish();
      };
      bootWindow.addEventListener('hierarchidb-worker-init-complete', handler, { once: true });
      const poll = bootWindow.setInterval(() => {
        // Defer to WorkerAPIClient if available
        import('~/WorkerAPIClient.js').then(({ WorkerAPIClient }) => {
          if (WorkerAPIClient.isReady()) {
            bootWindow.clearInterval(poll);
            finish();
          }
        }).catch(() => {});
      }, 100);
      // Soft cap; child loaders also set their own timeout
      bootWindow.setTimeout(() => { bootWindow.clearInterval(poll); finish(); }, 20000);
    });
  }

  const r = await loadWorkerAPIClient();
  return r;
}

export default function TLayout() {
  return <Outlet />;
}
