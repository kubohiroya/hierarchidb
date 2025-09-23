import { useEffect, useMemo, useState } from 'react';
import { createAdapterFromProgressSubscribe, useBatchProgress } from '@hierarchidb/ui-core';
import {
  ProgressEmitter,
  type ProgressSnapshot,
  type ProgressSnapshotStore,
} from '@hierarchidb/runtime-shared-batch-processor';
import type { ProgressEvent } from '@hierarchidb/common-type';

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
    () => createAdapterFromProgressSubscribe((cb) =>
      emitter.on((snapshot: ProgressSnapshot) => cb(toProgressEvent(snapshot)))
    ),
    [emitter],
  );
  const { progress } = useBatchProgress(adapter, {
    poll: store
      ? () => store.get(jobId).then((snapshot) => (snapshot ? toProgressEvent(snapshot) : null))
      : undefined,
  });

  return { snapshot: snap, ready, progress };
}

function toProgressEvent(snapshot: ProgressSnapshot): ProgressEvent {
  return {
    sessionId: snapshot.jobId,
    stage: snapshot.phase,
    total: 100,
    completed: snapshot.progress,
    failed: 0,
    percentage: snapshot.progress,
    currentTask: snapshot.phase ?? '',
  };
}
