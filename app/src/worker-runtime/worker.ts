/**
 * Worker entry point (error-safe)
 * Keep imports explicit to stabilize preview bundling.
 */

import './worker-react-refresh-shim.js';
import { WorkerInitializationReporter } from '@hierarchidb/ui-worker-client';
import { ensureRuntimeWorkerBootstrap } from './workerBootstrapUtils.ts';

const reporter = new WorkerInitializationReporter(
  [
    { name: 'Load Comlink', weight: 5 },
    { name: 'Load plugin loaders', weight: 10 },
    { name: 'Load plugin-loaders', weight: 35 },
    { name: 'Bootstrap services', weight: 30 },
    { name: 'Create API facade', weight: 10 },
    { name: 'Expose API', weight: 10 },
  ],
  false
);

reporter.reportStepProgress('Load Comlink', 0);

(async () => {
  try {
    const { api } = await ensureRuntimeWorkerBootstrap({
      reporter,
      messageTarget: self,
    });

    reporter.reportStepProgress('Expose API', 10);
    const Comlink = await import('comlink');
    Comlink.expose(api);
    reporter.reportStepProgress('Expose API', 100);
    reporter.reportComplete();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn('[worker bootstrap] runtime-worker-worker wiring failed:', err.message);
    reporter.reportError(err);
    throw err;
  }
})();
