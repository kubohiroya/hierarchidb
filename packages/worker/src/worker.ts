import * as Comlink from 'comlink';
import { workerError, workerLog } from '~/utils/workerLogger';
import { WorkerAPIImpl } from '~/WorkerAPIImpl';

// Create the worker API instance
const appName = import.meta.env.VITE_APP_NAME || 'hierarchidb';
const api = new WorkerAPIImpl(appName);

// Initialize the API
api
  .initialize()
  .then(() => {
    workerLog('worker.initialized');
  })
  .catch((error) => {
    workerError('worker.initializationFailed', {}, error);
  });

// Expose the API via Comlink
Comlink.expose(api);

// Default export for Vite worker imports
export default {};
