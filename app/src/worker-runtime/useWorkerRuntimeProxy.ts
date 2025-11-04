import { useMemo } from 'react';
import { useWorkerState } from './useWorkerStateStore.js';
import type { WorkerClientProxy, WorkerRuntimeState } from './WorkerClientProxy.js';
import { createWorkerClientProxy } from './WorkerClientProxy.js';

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
