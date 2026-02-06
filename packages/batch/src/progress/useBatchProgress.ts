import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnifiedProgressInfo } from '@hierarchidb/batch-api';
import type { BatchProgressAdapter, UseBatchProgressOptions } from '@hierarchidb/batch-api';

type Unsubscribe = () => void;

type SubscribeResult = Unsubscribe | Promise<Unsubscribe>;

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
  const flushFrameRef = useRef<number | null>(null);
  const adapterRef = useRef<Adapter>(adapter);
  const lastProgressRef = useRef<UnifiedProgressInfo | null>(null);

  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  const update = useCallback(() => {
    flushFrameRef.current = null;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) {
      const prev = lastProgressRef.current;
      if (prev && prev.stage === next.stage && next.percentage < prev.percentage) {
        return;
      }
      const isSame = Boolean(
        prev
        && prev.stage === next.stage
        && prev.phase === next.phase
        && prev.percentage === next.percentage
        && prev.completed === next.completed
        && prev.failed === next.failed
        && prev.total === next.total
        && prev.message === next.message
      );
      if (isSame) return;
      lastProgressRef.current = next;
      setProgress(next);
    }
  }, []);

  const subscribe = useCallback(() => {
    const currentAdapter = adapterRef.current;
    if (!currentAdapter || subscribedRef.current) return;
    const result: SubscribeResult = currentAdapter.subscribe((info: UnifiedProgressInfo) => {
      pendingRef.current = info;
      if (flushFrameRef.current !== null) return;
      flushFrameRef.current = window.requestAnimationFrame(update);
    });
    if (typeof result === 'function') {
      unsubRef.current = result;
    } else if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<Unsubscribe>).then((value) => {
        if (typeof value === 'function') {
          unsubRef.current = value;
        }
      });
    }
    subscribedRef.current = true;
    setSubscribed(true);
  }, [update]);

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
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      pendingRef.current = null;
    };
  }, []);

  return { progress, subscribed, subscribe, unsubscribe } as const;
}
