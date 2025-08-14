import * as Comlink from 'comlink';
import { WorkerAPIImpl } from './WorkerAPIImpl';
import { workerLog, workerError } from './utils/workerLogger';

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
