import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProgressPayload, BatchSessionId } from '@hierarchidb/batch-api';

export interface UnifiedProgressInfo {
  stage: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTask: string;
  phase?: string;
  timestamp?: number;
  payload?: BatchProgressPayload;
  message?: string;
  nodeId?: NodeId;
  sessionId?: BatchSessionId;
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
    if (typeof result === 'function') {
      unsubRef.current = result;
    } else if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
      result.then((fn) => {
        unsubRef.current = fn;
      });
    } else {
      unsubRef.current = null;
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
