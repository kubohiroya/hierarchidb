import type { NodeType } from '@hierarchidb/common-types';
import type { BatchSessionStatus } from '@hierarchidb/common-api';
import { useBatchProgressState } from '@hierarchidb/ui-batch';
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
    progress: unifiedProgress,
    status,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  } = useBatchProgressState(
    SHAPE_NODE_TYPE,
    sessionId,
    {
      autoSubscribe,
      enablePollingFallback,
      mapStatusToUnified: statusToUnified,
    },
  );

  const progress = toShapeProgress(unifiedProgress as ExtendedProgress | null, sessionId ?? undefined);
  const derivedStatus = toShapeStatus(unifiedProgress as ExtendedProgress | null, status as BatchSessionStatus | null);

  return {
    progress,
    status: derivedStatus,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  };
}
