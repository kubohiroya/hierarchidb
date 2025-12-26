import type { NodeType } from '@hierarchidb/common-types';
import type { BatchSessionStatus } from '@hierarchidb/common-api';
import { usePluginBatchProgress } from '@hierarchidb/ui-batch';
import {
  statusToUnified,
  toShapeProgress,
  toShapeStatus,
  type ExtendedProgress,
  type ShapeProgress,
  type ShapeProgressStatus,
} from './progress/shapeProgressMapping.js';

export type { ShapeProgress, ShapeProgressStatus };

export interface ShapeProgressState {
  progress: ShapeProgress | null;
  status: ShapeProgressStatus | null;
  isSubscribed: boolean;
  error: Error | null;
}

export interface UseShapeProgressOptions {
  autoSubscribe?: boolean;
  enablePollingFallback?: boolean;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;

export function useShapeProgress(
  sessionId: string | null,
  options: UseShapeProgressOptions = {},
): ShapeProgressState & { subscribe: () => void; unsubscribe: () => void } {
  const {
    autoSubscribe = true,
    enablePollingFallback = true,
  } = options;
  const {
    progress,
    status: derivedStatus,
    rawStatus,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  } = usePluginBatchProgress<ShapeProgress, ShapeProgressStatus>(
    SHAPE_NODE_TYPE,
    sessionId,
    {
      autoSubscribe,
      enablePollingFallback,
      mapStatusToUnified: statusToUnified,
      mapUnifiedToProgress: (info, id) => toShapeProgress(info as ExtendedProgress | null, id),
      mapUnifiedToStatus: (info, fallback) => toShapeStatus(info as ExtendedProgress | null, fallback as BatchSessionStatus | null),
    },
  );
  const debugKey = sessionId ?? 'none';
  const debugSnapshot = {
    sessionId,
    autoSubscribe,
    enablePollingFallback,
    isSubscribed,
    error: error?.message ?? null,
    unifiedStatus: rawStatus?.status ?? null,
    derivedStatus: derivedStatus?.status ?? null,
    progress: progress?.percentage ?? null,
    currentStage: progress?.currentStage ?? null,
    currentTask: progress?.currentTask ?? null,
  };

  if (typeof window !== 'undefined') {
    const lastKey = `__shapeProgressDebug_${debugKey}`;
    const prev = (window as unknown as Record<string, unknown>)[lastKey] as typeof debugSnapshot | undefined;
    const changed = !prev || Object.keys(debugSnapshot).some((key) => prev[key as keyof typeof debugSnapshot] !== debugSnapshot[key as keyof typeof debugSnapshot]);
    if (changed) {
      console.debug('[ShapeBuildProgressStep] progressState', debugSnapshot);
      (window as unknown as Record<string, unknown>)[lastKey] = debugSnapshot;
    }
  }

  return {
    progress,
    status: derivedStatus,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  };
}
