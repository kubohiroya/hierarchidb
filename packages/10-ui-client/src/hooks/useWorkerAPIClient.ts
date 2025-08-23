import { useLoaderData } from 'react-router-dom';
import type { WorkerAPIClient } from '../client/WorkerAPIClient';

/**
 * clientLoaderで初期化されたWorkerServicesClientを取得するフック
 *
 */

export function useWorkerAPIClient(): WorkerAPIClient {
  const workerAPIClientLoaderData = useLoaderData() as WorkerAPIClient;
  return workerAPIClientLoaderData;
}
