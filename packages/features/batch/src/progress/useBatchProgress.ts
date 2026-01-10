import { useCallback, useEffect, useRef, useState } from 'react';
import type { BatchProgressAdapter, UnifiedProgressInfo, UseBatchProgressOptions } from '@hierarchidb/common-api';

type Unsubscribe = () => void;

type SubscribeResult = Unsubscribe | Promise<Unsubscribe | void> | void;

type Adapter = BatchProgressAdapter | null;

export function useBatchProgress(
  adapter: Adapter,
  { autoSubscribe = true }: UseBatchProgressOptions = {},
) {
  const [progress, setProgress] = useState<UnifiedProgressInfo | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const unsubRef = useRef<Unsubscribe | null>(null);
  const subscribedRef = useRef(false);
  const pendingRef = useRef<UnifiedProgressInfo | null>(null);
  const flushTimerRef = useRef<number | null>(null);

  const subscribe = useCallback(() => {
    if (!adapter || subscribedRef.current) return;
    const result: SubscribeResult = adapter.subscribe((info: UnifiedProgressInfo) => {
      pendingRef.current = info;
      if (flushTimerRef.current) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        const next = pendingRef.current;
        pendingRef.current = null;
        if (next) {
          setProgress(next);
        }
      }, 100);
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
    return () => {
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingRef.current = null;
    };
  }, []);

  return { progress, subscribed, subscribe, unsubscribe } as const;
}
