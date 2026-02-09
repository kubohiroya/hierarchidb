import { useMemo } from 'react';
import type { NodeType } from '@hierarchidb/core-types';
import type { BuildSessionStatus, BuildUnifiedProgressInfo } from '@hierarchidb/batch-api';
import { useBatchProgressState, type UseBatchProgressStateOptions } from './useBatchProgressState.js';

export type UsePluginBatchProgressOptions<TProgress, TStatus> = UseBatchProgressStateOptions & {
  mapUnifiedToProgress: (info: BuildUnifiedProgressInfo | null, nodeId?: string) => TProgress | null;
  mapUnifiedToStatus?: (info: BuildUnifiedProgressInfo | null) => TStatus | null;
};

export interface PluginBatchProgressState<TProgress, TStatus> {
  progress: TProgress | null;
  status: TStatus | null;
  unifiedProgress: BuildUnifiedProgressInfo | null;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

export const usePluginBatchProgress = <TProgress, TStatus = BuildSessionStatus>(
  nodeType: NodeType,
  nodeId: string | null,
  options: UsePluginBatchProgressOptions<TProgress, TStatus>,
): PluginBatchProgressState<TProgress, TStatus> => {
  const { mapUnifiedToProgress, mapUnifiedToStatus, ...stateOptions } = options;
  const {
    progress: unifiedProgress,
    error,
    subscribe,
    unsubscribe,
  } = useBatchProgressState(nodeType, nodeId, stateOptions);

  const progress = useMemo(
    () => mapUnifiedToProgress(unifiedProgress, nodeId ?? undefined),
    [mapUnifiedToProgress, nodeId, unifiedProgress],
  );

  const status = useMemo(() => {
    if (!mapUnifiedToStatus) return null;
    return mapUnifiedToStatus(unifiedProgress);
  }, [mapUnifiedToStatus, unifiedProgress]);

  return {
    progress,
    status,
    unifiedProgress,
    error,
    subscribe,
    unsubscribe,
  };
};
