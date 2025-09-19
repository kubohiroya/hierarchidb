/**
 * Public exports for app package
 * These can be imported by plugins and other packages
 */

// Worker client singleton
export { WorkerAPIClient } from './WorkerAPIClient.js';

// React hook for Worker client
export { useWorkerAPIClient } from './hooks/useWorkerAPIClient.js';