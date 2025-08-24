/**
 * Return type for useWorkerServices hook
 */
import type { WorkerAPIClient } from '../client/WorkerAPIClient';

export interface UseWorkerAPIClientReturn {
  /** The main WorkerServicesClient instance */
  client: WorkerAPIClient;

  /** Test Worker connection */
  ping: () => Promise<boolean>;

  /** Cleanup Worker connection */
  cleanup: () => Promise<void>;
}
