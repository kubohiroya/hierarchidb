/**
 * Worker setup module
 * Configures the Worker URL for the application
 */

import { setWorkerUrl } from '@hierarchidb/10-ui-client';

// Import worker using Vite's ?worker suffix
// This tells Vite to build this as a separate worker bundle
import WorkerUrl from './worker?worker&url';

// Configure the worker URL
setWorkerUrl(WorkerUrl);

export { WorkerUrl as workerUrl };