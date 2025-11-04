import { useEffect, useState } from 'react';
import {
  ensureWorkerInitialized, getWorkerSnapshot,
  subscribeWorkerProgress, subscribeWorkerState, WorkerInitializationProgress, WorkerStateSnapshot } from '~/worker-runtime/WorkerStateStore.ts';

export function useWorkerState(): WorkerStateSnapshot {
  const [snapshot, setSnapshot] = useState<WorkerStateSnapshot>(() => getWorkerSnapshot());

  useEffect(() => subscribeWorkerState(setSnapshot), []);

  return snapshot;
}

export function useWorkerProgress(): WorkerInitializationProgress {
  const [progress, setProgress] = useState<WorkerInitializationProgress>(
    () => getWorkerSnapshot().progress
  );

  useEffect(() => subscribeWorkerProgress(setProgress), []);

  return progress;
}

export function useEnsureWorkerInitialized() {
  return ensureWorkerInitialized;
}
