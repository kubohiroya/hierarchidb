import { useCallback, useEffect, useRef, useState } from 'react';

export interface UnifiedProgressInfo {
  stage: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTask: string;
}

export interface UseBatchProgressOptions {
  autoSubscribe?: boolean;
  poll?: () => Promise<UnifiedProgressInfo | null>;
}

export interface BatchProgressAdapter {
  subscribe: (cb: (p: UnifiedProgressInfo) => void) => (() => void) | Promise<() => void>;
}

export function useBatchProgress(
  adapter: BatchProgressAdapter | null,
  { autoSubscribe = true, poll }: UseBatchProgressOptions = {},
) {
  const [progress, setProgress] = useState<UnifiedProgressInfo | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const unsubRef = useRef<null | (() => void)>(null);

  const subscribe = useCallback(() => {
    if (!adapter || subscribed) return;
    const result = adapter.subscribe((p) => setProgress(p));
    if (result && typeof (result as any).then === 'function') {
      (result as Promise<() => void>).then((fn) => (unsubRef.current = fn));
    } else {
      unsubRef.current = result as () => void;
    }
    setSubscribed(true);
  }, [adapter, subscribed]);

  const unsubscribe = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
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
    if (progress?.stage === 'completed') return;
    let id: any;
    const tick = async () => {
      try {
        const p = await poll();
        if (p) setProgress(p);
      } catch {
      }
      id = setTimeout(tick, 2000);
    };
    tick();
    return () => clearTimeout(id);
  }, [poll, progress?.stage]);

  return { progress, subscribed, subscribe, unsubscribe } as const;
}
