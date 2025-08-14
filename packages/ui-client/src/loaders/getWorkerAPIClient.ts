import { WorkerAPIClient } from '../client/WorkerAPIClient';

export interface WorkerAPIClientLoaderData {
  workerAPIClient: WorkerAPIClient;
}
/**
 * WorkerServicesClientを初期化して返す
 * 初回のみ初期化を行い、以降はキャッシュされたインスタンスを返す
 */
export async function getWorkerAPIClient(): Promise<WorkerAPIClient> {
  return await WorkerAPIClient.getSingleton();
}
