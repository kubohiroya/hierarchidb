import { useCallback, useEffect, useRef, useState } from 'react';
import type { BatchProgressAdapter, UnifiedProgressInfo, UseBatchProgressOptions } from '@hierarchidb/common-api';

type Unsubscribe = () => void;

type SubscribeResult = Unsubscribe | Promise<Unsubscribe | void> | void;

type Adapter = BatchProgressAdapter | null;

export function useBatchProgress(
  adapter: Adapter,
  { autoSubscribe = true, poll }: UseBatchProgressOptions = {},
) {
  const [progress, setProgress] = useState<UnifiedProgressInfo | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const unsubRef = useRef<Unsubscribe | null>(null);
  const subscribedRef = useRef(false);

  const subscribe = useCallback(() => {
    if (!adapter || subscribedRef.current) return;
    const result: SubscribeResult = adapter.subscribe((info: UnifiedProgressInfo) => {
      setProgress(info);
    });
    if (typeof result === 'function') {
      unsubRef.current = result;
    } else if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<Unsubscribe | void>).then((value) => {
        if (typeof value === 'function') {
          unsubRef.current = value;
        }
      });
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const value = await poll();
      if (value) setProgress(value);
      timer = setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [poll, progress?.phase]);

  return { progress, subscribed, subscribe, unsubscribe } as const;
}
