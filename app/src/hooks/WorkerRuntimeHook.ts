import type { WorkerClientProxy } from '~/worker-runtime/WorkerClientProxy';
import type { WorkerRuntimeState } from '~/worker-runtime/WorkerStateStore';

export type WorkerRuntimeHook = {
  proxy: WorkerClientProxy;
  state: WorkerRuntimeState;
  error: Error | null;
};
