import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toNodeId, type NodeType } from '@hierarchidb/core-types';
import type {
  BuildProgressAdapter,
  BuildUnifiedProgressInfo,
  ProgressPhase,
  StageKey,
} from '@hierarchidb/build-api';

import { useBuildProgress } from '@hierarchidb/build-runtime-services';
import { getBuildWorkerBridge, type BuildWorkerBridge } from '@hierarchidb/ui-worker-client';

export type UseBuildProgressStateOptions = {
  autoSubscribe?: boolean;
};

export interface BuildProgressState {
  progress: BuildUnifiedProgressInfo | null;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

/** Known ProgressPhase values per build-api. */
const KNOWN_PHASES = new Set<string>([
  'idle', 'queued', 'running', 'paused', 'completed', 'failed', 'recycled',
]);

const resolvePhase = (value: unknown): ProgressPhase => {
  if (typeof value === 'string' && KNOWN_PHASES.has(value)) {
    return value as ProgressPhase;
  }
  return 'idle';
};

const readFiniteNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const readString = (value: unknown): string | undefined => (
  typeof value === 'string' ? value : undefined
);

/**
 * Converts a sessionStatusUpdated event (unknown shape from worker bridge) to
 * BuildProgressEvent (= BuildUnifiedProgressInfo alias).
 * Only phase, stage, and timestamp are populated —
 * task counts (total/completed/failed) come from subscribeBuildTasks separately.
 * payload.total/completed/failed are set to 0 as required by BuildProgressPayload contract.
 */
const sessionStatusEventToUnifiedProgress = (
  event: unknown,
  nodeIdStr: string,
): BuildUnifiedProgressInfo | null => {
  if (!event || typeof event !== 'object') return null;
  const ev = event as Record<string, unknown>;

  if (readString(ev.type) !== 'sessionStatusUpdated') return null;

  const payload = ev.payload;
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  const phase = resolvePhase(p.phase);
  const stage = (readString(p.stageId) ?? 'source') as StageKey;
  const timestamp =
    readFiniteNumber(p.stageHeartbeatAt) ??
    readFiniteNumber(p.completedAt) ??
    readFiniteNumber(p.startedAt) ??
    Date.now();

  return {
    nodeId: toNodeId(nodeIdStr),
    stage,
    phase,
    timestamp,
    payload: { total: 0, completed: 0, failed: 0 },
    message: readString(p.stopReason),
  };
};

export const useBuildProgressState = (
  nodeType: NodeType,
  nodeId: string | null,
  options: UseBuildProgressStateOptions,
): BuildProgressState => {
  const { autoSubscribe = true } = options;
  const bridgeRef = useRef<BuildWorkerBridge>(getBuildWorkerBridge());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!nodeId || !autoSubscribe) return;
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
    });
  }, [autoSubscribe, nodeId]);

  // Reset error when nodeId changes
  useEffect(() => {
    setError(null);
  }, [nodeId]);

  const adapter = useMemo((): BuildProgressAdapter | null => {
    if (!nodeId) return null;
    const resolvedNodeId = toNodeId(nodeId);
    const nodeIdStr = nodeId;
    return {
      subscribe: (consumer: (info: BuildUnifiedProgressInfo) => void) =>
        bridgeRef.current
          .subscribeSessionState(nodeType, resolvedNodeId, (event: unknown) => {
            const info = sessionStatusEventToUnifiedProgress(event, nodeIdStr);
            if (info !== null) {
              consumer(info);
            }
          })
          .then((unsubscribe: () => void) => {
            setError(null);
            return unsubscribe;
          })
          .catch((err: unknown) => {
            const errObj = err instanceof Error
              ? err
              : new Error('Failed to subscribe to session state');
            setError(errObj);
            return () => { };
          }),
    };
  }, [nodeType, nodeId]);

  const {
    progress: unifiedProgress,
    subscribe: sharedSubscribe,
    unsubscribe: sharedUnsubscribe,
  } = useBuildProgress(adapter, { autoSubscribe });

  const subscribe = useCallback(() => {
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
    });
    sharedSubscribe();
  }, [sharedSubscribe]);

  const unsubscribe = useCallback(() => {
    sharedUnsubscribe();
  }, [sharedUnsubscribe]);

  return {
    progress: unifiedProgress,
    error,
    subscribe,
    unsubscribe,
  };
};
