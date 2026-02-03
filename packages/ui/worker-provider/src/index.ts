// React provider/hooks for runtime-worker worker client

import { useWorkerAPI as useWorkerAPIImpl } from './hooks/useWorkerAPI.js';

export const useWorkerAPI = useWorkerAPIImpl;
export { createWorkerClientProvider } from './provider/WorkerClientProvider.js';
export type { WorkerProviderProps } from './provider/WorkerProvider.js';
export { createWorkerProvider } from './provider/WorkerProvider.js';
export { useWorker, WorkerSingletonProvider } from './provider/WorkerSingletonProvider.js';
export type { WorkerClientHook, WorkerClientRef } from './ui/workerClientHook.js';
export { getWorkerClientHook, registerWorkerClientHook } from './ui/workerClientHook.js';
