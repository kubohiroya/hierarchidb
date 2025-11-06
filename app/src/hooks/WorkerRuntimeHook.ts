import type { WorkerClientProxy } from '~/worker-runtime/WorkerClientProxy.ts';
import type { WorkerRuntimeState } from '~/worker-runtime/WorkerStateStore.ts';

export type WorkerRuntimeHook = {
  proxy: WorkerClientProxy;
  state: WorkerRuntimeState;
  error: Error | null;
};