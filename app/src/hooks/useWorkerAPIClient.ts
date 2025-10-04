import type { LoadWorkerAPIClientReturn } from '~/loader.js';
import { useWorkerClient } from '../contexts/WorkerProvider.js';

export function useWorkerAPIClient(): LoadWorkerAPIClientReturn {
  const { client } = useWorkerClient();
  if (!client) {
    throw new Error('Worker client is not initialized yet. Call initialize() before using the API.');
  }
  return { client };
}
