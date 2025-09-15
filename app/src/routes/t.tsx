import { Outlet } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router';
import { loadWorkerAPIClient, type LoadWorkerAPIClientReturn } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs): Promise<LoadWorkerAPIClientReturn> {
  
  // Create a shared barrier early so parent/child loaders converge on one wait
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = (typeof window !== 'undefined') ? (window as any) : {};
  if (!g.__HDB_INIT_WAIT__) {
    g.__HDB_INIT_WAIT__ = new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const handler = () => {
        window.removeEventListener('hierarchidb-worker-init-complete', handler);
        g.__HDB_INIT_COMPLETE__ = true;
        finish();
      };
      window.addEventListener('hierarchidb-worker-init-complete', handler, { once: true });
      const poll = window.setInterval(() => {
        // Defer to WorkerAPIClient if available
        import('~/WorkerAPIClient').then(({ WorkerAPIClient }) => {
          if (WorkerAPIClient.isReady()) {
            window.clearInterval(poll);
            finish();
          }
        }).catch(() => {});
      }, 100);
      // Soft cap; child loaders also set their own timeout
      window.setTimeout(() => { window.clearInterval(poll); finish(); }, 20000);
    });
  }

  const r = await loadWorkerAPIClient();
  return r;
}

export default function TLayout() {
  return <Outlet />;
}
