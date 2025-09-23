import type { LoadWorkerAPIClientReturn } from '~/loader.js';
import { useWorkerAPIClient as useWorkerAPIClientFromLoader } from '~/loader.js';

export function useWorkerAPIClient(): LoadWorkerAPIClientReturn {
  return useWorkerAPIClientFromLoader();
}
