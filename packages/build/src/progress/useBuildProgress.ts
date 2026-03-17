import { useCallback, useEffect, useRef, useState } from 'react';
import type { BuildProgressAdapter, BuildUnifiedProgressInfo, UseBuildProgressOptions } from '@hierarchidb/build-api';

type Unsubscribe = () => void;

type SubscribeResult = Unsubscribe | Promise<Unsubscribe>;

type Adapter = BuildProgressAdapter | null;
type ImportMetaEnv = Partial<Record<'DEV', boolean>>;
type ImportMetaWithEnv = { env?: ImportMetaEnv };

const isDev = typeof import.meta !== 'undefined'
  ? ((import.meta as ImportMetaWithEnv).env?.DEV === true)
  : false;
type ProgressDebugConfig = Partial<Record<'event' | 'skip' | 'all', boolean>>;

const readProgressDebugConfig = (): ProgressDebugConfig | null => {
  const scope = globalThis as typeof globalThis & {
    __HDB_BATCH_PROGRESS_DEBUG__?: unknown;
  };
  const raw = scope.__HDB_BATCH_PROGRESS_DEBUG__;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as ProgressDebugConfig;
};

const isProgressDebugEnabled = (channel: 'event' | 'skip'): boolean => {
  if (!isDev) return false;
  const config = readProgressDebugConfig();
  if (!config) return false;
  return config.all === true || config[channel] === true;
};

const logProgressEvent = (event: string, payload: Record<string, unknown>): void => {
  if (!isDev) return;
  console.debug('[BuildProgressTrace]', event, payload);
};

const resolveSkippedCount = (info: BuildUnifiedProgressInfo): number => {
  const payload = info.payload as Record<string, unknown> | undefined;
  const skipped = payload?.skipped;
  return typeof skipped === 'number' && Number.isFinite(skipped) ? skipped : 0;
};

const resolvePayloadNumber = (info: BuildUnifiedProgressInfo, key: 'total' | 'completed' | 'failed'): number => {
  const payload = info.payload as Record<string, unknown> | undefined;
  const value = payload?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[useBuildProgress] payload.${key} must be a finite number, received ${String(value)} (nodeId=${String(info.nodeId)}, stage=${String(info.stage)})`);
  }
  return value;
};

const resolvePercentage = (info: BuildUnifiedProgressInfo): number => {
  const payload = info.payload as Record<string, unknown> | undefined;
  const pct = payload?.percentage;
  if (typeof pct === 'number' && Number.isFinite(pct)) return pct;
  const total = resolvePayloadNumber(info, 'total');
  const completed = resolvePayloadNumber(info, 'completed');
  return total > 0 ? Math.round((completed / total) * 100) : 0;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const readString = (meta: Record<string, unknown> | null, key: string): string | undefined => {
  const value = meta?.[key];
  return typeof value === 'string' ? value : undefined;
};

const readNumber = (meta: Record<string, unknown> | null, key: string): number | undefined => {
  const value = meta?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const readPayloadMeta = (info: BuildUnifiedProgressInfo | null): Record<string, unknown> | null => {
  const payload = asRecord(info?.payload);
  if (!payload) return null;
  return asRecord(payload.meta);
};

const readTaskPayloadMeta = (meta: Record<string, unknown> | null): Record<string, unknown> | null => (
  asRecord(meta?.progressTask)
);

const buildProgressTaskSignature = (info: BuildUnifiedProgressInfo | null): string | undefined => {
  const payloadMeta = readPayloadMeta(info);
  if (!payloadMeta) return undefined;
  const progressTask = readTaskPayloadMeta(payloadMeta);
  if (!progressTask) return undefined;
  const progress = readNumber(progressTask, 'progress');
  return [
    readString(progressTask, 'taskId') ?? '',
    readString(progressTask, 'sequence') ?? readNumber(progressTask, 'sequence')?.toString() ?? '',
    readString(progressTask, 'status') ?? '',
    readString(progressTask, 'stage') ?? '',
    progress === undefined ? '' : `${progress}`,
    readString(progressTask, 'title') ?? '',
  ].join('|');
};

const buildStageTotalsSignature = (info: BuildUnifiedProgressInfo | null): string | undefined => {
  const payloadMeta = readPayloadMeta(info);
  if (!payloadMeta) return undefined;
  const stageTotals = asRecord(payloadMeta.stageTotals);
  const meta = readPayloadMeta(info);
  if (!meta) return undefined;
  if (!stageTotals) return undefined;
  const stages = ['source', 'geometry', 'tileEmit'] as const;
  return stages
    .map((stage) => {
      const stageValue = asRecord(stageTotals[stage]);
      if (!stageValue) return `${stage}:`;
      const readValue = (key: string): string => {
        const value = readNumber(stageValue, key);
        return Number.isFinite(value) ? `${value}` : 'x';
      };
      return `${stage}:${readValue('total')}/${readValue('completed')}/${readValue('failed')}/${readValue('skipped')}`;
    })
    .join(';');
};

export function useBuildProgress(
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
  const lastSignaturesRef = useRef<{ progressTask: string | undefined; stageTotals: string | undefined }>({
    progressTask: undefined,
    stageTotals: undefined,
  });

  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  const update = useCallback(() => {
    flushFrameRef.current = null;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) {
      const hasMeta = !!readPayloadMeta(next);
      const prev = lastProgressRef.current;
      if (next.phase === 'completed') {
        const skipped = resolveSkippedCount(next);
        const total = resolvePayloadNumber(next, 'total');
        const completed = resolvePayloadNumber(next, 'completed');
        const failed = resolvePayloadNumber(next, 'failed');
        const done = completed + failed + skipped;
        if (total > 0 && done < total) {
          logProgressEvent('drop-complete-incomplete', {
            nodeId: next.nodeId,
            stage: next.stage,
            phase: next.phase,
            total,
            completed,
            failed,
            skipped,
            hasMeta,
          });
          return;
        }
      }
      const nextPercentage = resolvePercentage(next);
      const prevPercentage = prev ? resolvePercentage(prev) : 0;
      const normalized = prev && nextPercentage < prevPercentage
        ? { ...next, _normalizedPercentage: prevPercentage }
        : next;
      const normalizedPercentage = prev && nextPercentage < prevPercentage ? prevPercentage : nextPercentage;
      const progressTaskSignature = buildProgressTaskSignature(normalized);
      const stageTotalsSignature = buildStageTotalsSignature(normalized);
      const nextTotal = resolvePayloadNumber(next, 'total');
      const nextCompleted = resolvePayloadNumber(next, 'completed');
      const nextFailed = resolvePayloadNumber(next, 'failed');
      const prevTotal = prev ? resolvePayloadNumber(prev, 'total') : 0;
      const prevCompleted = prev ? resolvePayloadNumber(prev, 'completed') : 0;
      const prevFailed = prev ? resolvePayloadNumber(prev, 'failed') : 0;
      const isSame = Boolean(
        prev
        && prev.stage === normalized.stage
        && prev.phase === normalized.phase
        && normalizedPercentage === prevPercentage
        && nextCompleted === prevCompleted
        && nextFailed === prevFailed
        && nextTotal === prevTotal
        && prev.message === normalized.message
        && lastSignaturesRef.current.progressTask === progressTaskSignature
        && lastSignaturesRef.current.stageTotals === stageTotalsSignature
      );
      if (isSame) {
        if (isProgressDebugEnabled('skip')) {
          logProgressEvent('skip-unchanged', {
            nodeId: next.nodeId,
            stage: next.stage,
            phase: next.phase,
            percentage: normalizedPercentage,
            progressTaskSignature,
            stageTotalsSignature,
            hasMeta,
          });
        }
        return;
      }
      if (isProgressDebugEnabled('event')) {
        logProgressEvent('apply', {
          nodeId: next.nodeId,
          stage: next.stage,
          phase: next.phase,
          percentage: normalizedPercentage,
          total: nextTotal,
          completed: nextCompleted,
          failed: nextFailed,
          skipped: resolveSkippedCount(normalized),
          progressTaskSignature,
          stageTotalsSignature,
          hasMeta,
        });
      }
      lastProgressRef.current = normalized;
      lastSignaturesRef.current = {
        progressTask: progressTaskSignature,
        stageTotals: stageTotalsSignature,
      };
      setProgress(normalized);
    }
  }, []);

  const subscribe = useCallback(() => {
    const currentAdapter = adapterRef.current;
    if (!currentAdapter || subscribedRef.current) return;
    const subscriptionToken = subscriptionTokenRef.current + 1;
    subscriptionTokenRef.current = subscriptionToken;
    const result: SubscribeResult = currentAdapter.subscribe((info: BuildUnifiedProgressInfo) => {
      if (isProgressDebugEnabled('event')) {
        const payloadMeta = readPayloadMeta(info);
        const total = resolvePayloadNumber(info, 'total');
        const completed = resolvePayloadNumber(info, 'completed');
        const failed = resolvePayloadNumber(info, 'failed');
        logProgressEvent('received', {
          nodeId: info.nodeId,
          stage: info.stage,
          phase: info.phase,
          percentage: resolvePercentage(info),
          total,
          completed,
          failed,
          skipped: resolveSkippedCount(info),
          hasPayloadMeta: Boolean(payloadMeta),
          hasProgressTaskMeta: Boolean(payloadMeta && asRecord(payloadMeta.progressTask)),
          hasStageTotalsMeta: Boolean(payloadMeta && asRecord(payloadMeta.stageTotals)),
        });
      }
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
