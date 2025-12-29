import { useMemo } from 'react';
import type { NodeType } from '@hierarchidb/common-types';
import type { BatchSessionStatus, UnifiedProgressInfo } from '@hierarchidb/common-api';
import { useBatchProgressState, type UseBatchProgressStateOptions } from './useBatchProgressState.js';

export type UsePluginBatchProgressOptions<TProgress, TStatus> = UseBatchProgressStateOptions & {
  mapUnifiedToProgress: (info: UnifiedProgressInfo | null, nodeId?: string) => TProgress | null;
  mapUnifiedToStatus?: (info: UnifiedProgressInfo | null, status: BatchSessionStatus | null) => TStatus | null;
};

export interface PluginBatchProgressState<TProgress, TStatus> {
  progress: TProgress | null;
  status: TStatus | null;
  unifiedProgress: UnifiedProgressInfo | null;
  rawStatus: BatchSessionStatus | null;
  isSubscribed: boolean;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

export const usePluginBatchProgress = <TProgress, TStatus = BatchSessionStatus>(
  nodeType: NodeType,
  nodeId: string | null,
  options: UsePluginBatchProgressOptions<TProgress, TStatus>,
): PluginBatchProgressState<TProgress, TStatus> => {
  const { mapUnifiedToProgress, mapUnifiedToStatus, ...stateOptions } = options;
  const {
    progress: unifiedProgress,
    status: rawStatus,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  } = useBatchProgressState(nodeType, nodeId, stateOptions);

  const progress = useMemo(
    () => mapUnifiedToProgress(unifiedProgress, nodeId ?? undefined),
    [mapUnifiedToProgress, nodeId, unifiedProgress],
  );

  const status = useMemo(() => {
    if (mapUnifiedToStatus) {
      return mapUnifiedToStatus(unifiedProgress, rawStatus);
    }
    return (rawStatus as TStatus | null) ?? null;
  }, [mapUnifiedToStatus, rawStatus, unifiedProgress]);

  return {
    progress,
    status,
    unifiedProgress,
    rawStatus,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  };
};
