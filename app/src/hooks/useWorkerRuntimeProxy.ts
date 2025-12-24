import { useEffect, useMemo, useState } from 'react';
import { createWorkerClientProxy } from '~/worker-runtime/WorkerClientProxy.js';
import type { WorkerRuntimeHook } from '~/hooks/WorkerRuntimeHook.ts';

import {
  getWorkerSnapshot, subscribeWorkerState, type WorkerStateSnapshot } from '~/worker-runtime/WorkerStateStore.ts';

export function useWorkerRuntimeProxy(): WorkerRuntimeHook {
  const proxy = useMemo(() => createWorkerClientProxy(), []);
  const [snapshot, setSnapshot] = useState<WorkerStateSnapshot>(() => getWorkerSnapshot());
  useEffect(() => subscribeWorkerState(setSnapshot), []);
  return { proxy, state: snapshot.state, error: snapshot.error };
}
