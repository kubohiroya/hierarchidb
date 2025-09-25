import { useEffect, useState } from 'react';
import type { WorkerStateSnapshot, WorkerInitializationProgress } from './WorkerStateStore.js';
import {
  ensureWorkerInitialized,
  getWorkerSnapshot,
  subscribeWorkerProgress,
  subscribeWorkerState,
} from './WorkerStateStore.js';

export function useWorkerState(): WorkerStateSnapshot {
  const [snapshot, setSnapshot] = useState<WorkerStateSnapshot>(() => getWorkerSnapshot());

  useEffect(() => subscribeWorkerState(setSnapshot), []);

  return snapshot;
}

export function useWorkerProgress(): WorkerInitializationProgress {
  const [progress, setProgress] = useState<WorkerInitializationProgress>(() => getWorkerSnapshot().progress);

  useEffect(() => subscribeWorkerProgress(setProgress), []);

  return progress;
}

export function useEnsureWorkerInitialized() {
  return ensureWorkerInitialized;
}
