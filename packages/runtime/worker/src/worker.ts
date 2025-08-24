import * as Comlink from 'comlink';
import { workerError, workerLog } from './utils/workerLogger';
import { WorkerAPIImpl } from './WorkerAPIImpl';

// Create the worker API instance
const appName = import.meta.env.VITE_APP_NAME || 'hierarchidb';
const api = new WorkerAPIImpl(appName);

// Initialize the API and plugin APIs
api
  .initialize()
  .then(async () => {
    workerLog('worker.initialized');
    
    // Initialize plugin APIs for 3-layer architecture
    try {
      const { initializePluginAPIs } = await import('./plugins');
      await initializePluginAPIs(api);
      workerLog('Plugin APIs initialized');
    } catch (error) {
      workerError('Failed to initialize plugin APIs', {}, error);
    }
  })
  .catch((error) => {
    workerError('worker.initializationFailed', {}, error);
  });

// Expose the API via Comlink
Comlink.expose(api);

// Default export for Vite worker imports
export default {};
