import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnifiedProgressInfo } from '@hierarchidb/batch-api';
import type { BatchProgressAdapter, UseBatchProgressOptions } from '@hierarchidb/batch-api';

type Unsubscribe = () => void;

type SubscribeResult = Unsubscribe | Promise<Unsubscribe>;

type Adapter = BatchProgressAdapter | null;

const resolveSkippedCount = (info: UnifiedProgressInfo): number => {
  const payload = info.payload as Record<string, unknown> | undefined;
  const skipped = payload?.skipped;
  return typeof skipped === 'number' && Number.isFinite(skipped) ? skipped : 0;
};

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
      if (next.phase === 'completed') {
        const skipped = resolveSkippedCount(next);
        const done = next.completed + next.failed + skipped;
        if (next.total > 0 && done < next.total) {
          return;
        }
      }
      const normalized = prev && next.percentage < prev.percentage
        ? { ...next, percentage: prev.percentage }
        : next;
      const isSame = Boolean(
        prev
        && prev.stage === normalized.stage
        && prev.phase === normalized.phase
        && prev.percentage === normalized.percentage
        && prev.completed === normalized.completed
        && prev.failed === normalized.failed
        && prev.total === normalized.total
        && prev.message === normalized.message
      );
      if (isSame) return;
      lastProgressRef.current = normalized;
      setProgress(normalized);
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
