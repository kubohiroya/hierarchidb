/**
 * Public exports for app package.
 * These can be imported by plugin-loader and other packages.
 */

export type { WorkerAPIClient } from './WorkerAPIClient.ts';
export async function loadWorkerAPIClientModule(): Promise<typeof import('./WorkerAPIClient.ts')> {
  return await import('./WorkerAPIClient.ts');
}

// React hook for Worker client
export { useWorkerAPIClient } from './hooks/useWorkerAPIClient.ts';
