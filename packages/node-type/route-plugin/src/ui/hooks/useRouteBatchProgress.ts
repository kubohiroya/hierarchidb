import { useEffect, useMemo, useState } from 'react';
import { createAdapterFromProgressSubscribe, useBatchProgress } from '@hierarchidb/ui-core';
import {
  ProgressEmitter,
  type ProgressSnapshot,
  type ProgressSnapshotStore,
} from '@hierarchidb/runtime-shared-batch-processor';

export function useRouteBatchProgress(jobId: string, deps?: { emitter?: ProgressEmitter; store?: ProgressSnapshotStore }) {
  const emitter = useMemo(() => deps?.emitter ?? new ProgressEmitter(10), [deps?.emitter]);
  const store = deps?.store;
  const [snap, setSnap] = useState<ProgressSnapshot | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (store) {
        const s = await store.get(jobId);
        if (!cancelled && s) setSnap(s);
      }
      off = emitter.on((s: ProgressSnapshot) => {
        if (s.jobId === jobId) setSnap(s);
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, [jobId, emitter, store]);

  // Unify with ui-core batch progress for UI consumers
  const adapter = useMemo(
    () => createAdapterFromProgressSubscribe((cb) => emitter.on((s) => cb({
      stage: s.phase,
      total: 100,
      completed: s.progress,
      failed: 0,
      percentage: s.progress,
      currentTask: s.phase || '',
    } as any))),
    [emitter],
  );
  const { progress } = useBatchProgress(adapter, {
    poll: store
      ? () => store.get(jobId).then((s) => (s ? ({
        stage: s.phase,
        total: 100,
        completed: s.progress,
        failed: 0,
        percentage: s.progress,
        currentTask: s.phase || '',
      }) : null))
      : undefined,
  });

  return { snapshot: snap, ready, progress };
}
