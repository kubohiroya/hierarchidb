/**
 * Public exports for app package.
 * These can be imported by plugins and other packages.
 */

export type { WorkerAPIClient } from './WorkerAPIClient.js';
export async function loadWorkerAPIClientModule(): Promise<typeof import('./WorkerAPIClient.js')> {
  return await import('./WorkerAPIClient.js');
}

// React hook for Worker client
export { useWorkerAPIClient } from './hooks/useWorkerAPIClient.js';
