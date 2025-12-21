import { useCallback, useEffect, useRef, useState } from 'react';
import { BatchProgressAdapter, UnifiedProgressInfo, UseBatchProgressOptions } from '@hierarchidb/common-api';

type UnsubscribeFn = () => void;

export function useBatchProgress(
  adapter: BatchProgressAdapter | null,
  { autoSubscribe = true, poll }: UseBatchProgressOptions = {},
) {
  const [progress, setProgress] = useState<UnifiedProgressInfo | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const unsubRef = useRef<null | (() => void)>(null);
  const subscribedRef = useRef(false);

  const subscribe = useCallback(() => {
    if (!adapter || subscribedRef.current) return;
    const result = adapter.subscribe((p: UnifiedProgressInfo) => setProgress(p));
    if (typeof result === 'function') {
      unsubRef.current = result as UnsubscribeFn;
    } else if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
      void result.then((fn: UnsubscribeFn) => {
        unsubRef.current = fn;
      });
    } else {
      unsubRef.current = null;
    }
    subscribedRef.current = true;
    setSubscribed(true);
  }, [adapter]);

  const unsubscribe = useCallback(() => {
    if (!subscribedRef.current) return;
    unsubRef.current?.();
    unsubRef.current = null;
    subscribedRef.current = false;
    setSubscribed(false);
  }, []);

  useEffect(() => {
    if (adapter && autoSubscribe) subscribe();
    return () => {
      unsubscribe();
    };
  }, [adapter, autoSubscribe, subscribe, unsubscribe]);

  useEffect(() => {
    if (!poll) return;
    if (progress?.phase === 'completed' || progress?.phase === 'cancelled') return;
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const p = await poll();
      if (p) setProgress(p);
      id = setTimeout(tick, 2000);
    };
    tick();
    return () => {
      if (id !== undefined) {
        clearTimeout(id);
      }
    };
  }, [poll, progress?.phase]);

  return { progress, subscribed, subscribe, unsubscribe } as const;
}
