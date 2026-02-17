import { useMemo } from 'react';
import type { NodeType } from '@hierarchidb/core-types';
import type { BuildSessionStatus, BuildUnifiedProgressInfo } from '@hierarchidb/batch-api';
import { useBuildProgressState, type UseBuildProgressStateOptions } from './useBuildProgressState.js';

export type UsePluginBuildProgressOptions<TProgress, TStatus> = UseBuildProgressStateOptions & {
  mapUnifiedToProgress: (info: BuildUnifiedProgressInfo | null, nodeId?: string) => TProgress | null;
  mapUnifiedToStatus?: (info: BuildUnifiedProgressInfo | null) => TStatus | null;
};

export interface PluginBuildProgressState<TProgress, TStatus> {
  progress: TProgress | null;
  status: TStatus | null;
  unifiedProgress: BuildUnifiedProgressInfo | null;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

export const usePluginBuildProgress = <TProgress, TStatus = BuildSessionStatus>(
  nodeType: NodeType,
  nodeId: string | null,
  options: UsePluginBuildProgressOptions<TProgress, TStatus>,
): PluginBuildProgressState<TProgress, TStatus> => {
  const { mapUnifiedToProgress, mapUnifiedToStatus, ...stateOptions } = options;
  const {
    progress: unifiedProgress,
    error,
    subscribe,
    unsubscribe,
  } = useBuildProgressState(nodeType, nodeId, stateOptions);

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
