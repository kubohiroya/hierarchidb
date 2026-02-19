import { useEffect, useMemo, useState } from 'react';
import type { WorkerRuntimeHook } from '~/hooks/WorkerRuntimeHook';
import { createWorkerClientProxy } from '~/worker-runtime/WorkerClientProxy';

import {
  getWorkerSnapshot,
  subscribeWorkerState,
  type WorkerStateSnapshot,
} from '~/worker-runtime/WorkerStateStore';

export function useWorkerRuntimeProxy(): WorkerRuntimeHook {
  const proxy = useMemo(() => createWorkerClientProxy(), []);
  const [snapshot, setSnapshot] = useState<WorkerStateSnapshot>(() => getWorkerSnapshot());
  useEffect(() => subscribeWorkerState(setSnapshot), []);
  return { proxy, state: snapshot.state, error: snapshot.error };
}
