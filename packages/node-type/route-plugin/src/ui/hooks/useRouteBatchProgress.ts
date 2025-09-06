import { useEffect, useMemo, useState } from 'react';
import { ProgressEmitter, type ProgressSnapshot, type ProgressSnapshotStore } from '@hierarchidb/runtime-shared-batch-processor';

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
      off = emitter.on((s: ProgressSnapshot) => { if (s.jobId === jobId) setSnap(s); });
      setReady(true);
    })();
    return () => { cancelled = true; off?.(); };
  }, [jobId, emitter, store]);

  return { snapshot: snap, ready };
}
