import { useMemo } from 'react';
import { useWorkerState } from './useWorkerStateStore.js';
import type { WorkerClientProxy, WorkerRuntimeState } from '~/worker-runtime/WorkerClientProxy.js';
import { createWorkerClientProxy } from '~/worker-runtime/WorkerClientProxy.js';

export type WorkerRuntimeHook = {
  proxy: WorkerClientProxy;
  state: WorkerRuntimeState;
  error: Error | null;
};

export function useWorkerRuntimeProxy(): WorkerRuntimeHook {
  const proxy = useMemo(() => createWorkerClientProxy(), []);
  const snapshot = useWorkerState();

  return { proxy, state: snapshot.state, error: snapshot.error };
}
