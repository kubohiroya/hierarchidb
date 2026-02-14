import { useCallback, useEffect, useRef, useState } from 'react';
import type { BuildProgressAdapter, BuildUnifiedProgressInfo, UseBuildProgressOptions } from '@hierarchidb/batch-api';

type Unsubscribe = () => void;

type SubscribeResult = Unsubscribe | Promise<Unsubscribe>;

type Adapter = BuildProgressAdapter | null;

const resolveSkippedCount = (info: BuildUnifiedProgressInfo): number => {
  const payload = info.payload as Record<string, unknown> | undefined;
  const skipped = payload?.skipped;
  return typeof skipped === 'number' && Number.isFinite(skipped) ? skipped : 0;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readString = (meta: Record<string, unknown> | null, key: string): string | undefined => {
  const value = meta?.[key];
  return typeof value === 'string' ? value : undefined;
};

const readNumber = (meta: Record<string, unknown> | null, key: string): number | undefined => {
  const value = meta?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const buildProgressTaskSignature = (info: BuildUnifiedProgressInfo | null): string | undefined => {
  const payload = asRecord(info?.payload);
  if (!payload) return undefined;
  const meta = asRecord(payload.meta);
  if (!meta) return undefined;
  const progressTask = asRecord(meta.progressTask);
  if (!progressTask) return undefined;
  return [
    typeof progressTask.taskId === 'string' ? progressTask.taskId : '',
    typeof progressTask.sequence === 'number' && Number.isFinite(progressTask.sequence)
      ? `${progressTask.sequence}`
      : '',
    typeof progressTask.status === 'string' ? progressTask.status : '',
    readString(progressTask, 'stage') ?? '',
    Number.isFinite(readNumber(progressTask, 'progress'))
      ? `${readNumber(progressTask, 'progress')}`
      : '',
    readString(progressTask, 'title') ?? '',
  ].join('|');
};

const buildStageTotalsSignature = (info: BuildUnifiedProgressInfo | null): string | undefined => {
  const payload = asRecord(info?.payload);
  if (!payload) return undefined;
  const meta = asRecord(payload.meta);
  if (!meta) return undefined;
  const stageTotals = asRecord(meta.stageTotals);
  if (!stageTotals) return undefined;
  const stages = ['fetch', 'transform', 'vt'] as const;
  const lines = stages
    .map((stage) => {
      const stageValue = asRecord(stageTotals[stage]);
      if (!stageValue) return `${stage}:`;
      const readValue = (key: string): string => {
        const value = readNumber(stageValue, key);
        if (typeof value !== 'number' || !Number.isFinite(value)) return 'x';
        return `${value}`;
      };
      return `${stage}:${readValue('total')}/${readValue('completed')}/${readValue('failed')}/${readValue('skipped')}`;
    })
    .join(';');
  return lines;
};

export function useBatchProgress(
  adapter: Adapter,
  { autoSubscribe = true }: UseBuildProgressOptions = {},
) {
  const [progress, setProgress] = useState<BuildUnifiedProgressInfo | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const unsubRef = useRef<Unsubscribe | null>(null);
  const subscribedRef = useRef(false);
  const subscriptionTokenRef = useRef(0);
  const pendingRef = useRef<BuildUnifiedProgressInfo | null>(null);
  const flushFrameRef = useRef<number | null>(null);
  const adapterRef = useRef<Adapter>(adapter);
  const lastProgressRef = useRef<BuildUnifiedProgressInfo | null>(null);

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
        && buildProgressTaskSignature(prev) === buildProgressTaskSignature(normalized)
        && buildStageTotalsSignature(prev) === buildStageTotalsSignature(normalized)
      );
      if (isSame) return;
      lastProgressRef.current = normalized;
      setProgress(normalized);
    }
  }, []);

  const subscribe = useCallback(() => {
    const currentAdapter = adapterRef.current;
    if (!currentAdapter || subscribedRef.current) return;
    const subscriptionToken = subscriptionTokenRef.current + 1;
    subscriptionTokenRef.current = subscriptionToken;
    const result: SubscribeResult = currentAdapter.subscribe((info: BuildUnifiedProgressInfo) => {
      pendingRef.current = info;
      if (flushFrameRef.current !== null) return;
      flushFrameRef.current = window.requestAnimationFrame(update);
    });
    if (typeof result === 'function') {
      unsubRef.current = result;
    } else if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<Unsubscribe>).then((value) => {
        if (typeof value !== 'function') {
          return;
        }
        if (subscriptionTokenRef.current !== subscriptionToken || !subscribedRef.current) {
          value();
          return;
        }
        unsubRef.current = value;
      });
    }
    subscribedRef.current = true;
    setSubscribed((prev) => (prev ? prev : true));
  }, [update]);

  const unsubscribe = useCallback((notify = true) => {
    if (!subscribedRef.current && !unsubRef.current) return;
    subscriptionTokenRef.current += 1;
    const unsubscribeCurrent = unsubRef.current;
    unsubRef.current = null;
    unsubscribeCurrent?.();
    subscribedRef.current = false;
    if (notify) {
      setSubscribed((prev) => (prev ? false : prev));
    }
  }, []);

  useEffect(() => {
    if (adapter && autoSubscribe) subscribe();
    return () => {
      unsubscribe(false);
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
