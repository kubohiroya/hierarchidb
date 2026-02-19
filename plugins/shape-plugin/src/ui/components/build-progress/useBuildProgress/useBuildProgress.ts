import { useEffect, useRef } from 'react';
import type { NodeType } from '@hierarchidb/core-types';
import type { BuildUnifiedProgressInfo } from '@hierarchidb/batch-api';
import { usePluginBuildProgress } from '@hierarchidb/ui-batch-progress';
import {
  toShapeProgress,
  toShapeStatus,
  type ExtendedProgress,
  type BuildProgress,
  type BuildProgressStatus,
} from '~/ui/components/build-progress/shapeBuildProgressMapping';

export type { BuildProgress, BuildProgressStatus };

export interface ShapeProgressState {
  progress: BuildProgress | null;
  status: BuildProgressStatus | null;
  error: Error | null;
}

export interface UseBuildProgressOptions {
  autoSubscribe?: boolean;
}

const isDev = import.meta.env.DEV;
type BuildProgressDebugConfig = Partial<Record<'mapping' | 'all', boolean>>;

const readBuildProgressDebugConfig = (): BuildProgressDebugConfig | null => {
  const scope = globalThis as typeof globalThis & {
    __HDB_SHAPE_BUILD_PROGRESS_DEBUG__?: unknown;
  };
  const raw = scope.__HDB_SHAPE_BUILD_PROGRESS_DEBUG__;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as BuildProgressDebugConfig;
};

const isBuildProgressDebugEnabled = (): boolean => {
  if (!isDev) return false;
  const config = readBuildProgressDebugConfig();
  if (!config) return false;
  return config.all === true || config.mapping === true;
};

const logProgressMapping = (nodeId: string | null, payload: {
  unifiedExists: boolean;
  mappedExists: boolean;
  progressTaskId?: string | null;
  progressTaskStatus?: string | null;
  stageTotals?: string;
}): void => {
  if (!isDev) return;
  const hasStageTotals = payload.stageTotals !== undefined;
  console.debug('[ShapeBuildProgressMappingTrace]', {
    nodeId,
    unifiedExists: payload.unifiedExists,
    mappedExists: payload.mappedExists,
    progressTaskId: payload.progressTaskId ?? null,
    progressTaskStatus: payload.progressTaskStatus ?? null,
    stageTotals: hasStageTotals ? payload.stageTotals : null,
  });
};

const SHAPE_NODE_TYPE = 'shape' as NodeType;

export function useBuildProgress(
  nodeId: string | null,
  options: UseBuildProgressOptions = {},
): ShapeProgressState & { subscribe: () => void; unsubscribe: () => void } {
  const {
    autoSubscribe = true,
  } = options;
  const {
    progress,
    status: derivedStatus,
    unifiedProgress,
    error,
    subscribe,
    unsubscribe,
  } = usePluginBuildProgress<BuildProgress, BuildProgressStatus>(
    SHAPE_NODE_TYPE,
    nodeId,
    {
      autoSubscribe,
      mapUnifiedToProgress: (info: BuildUnifiedProgressInfo | null) => toShapeProgress(info as ExtendedProgress | null),
      mapUnifiedToStatus: (info: BuildUnifiedProgressInfo | null) => toShapeStatus(info as ExtendedProgress | null),
    },
  );

  const previousSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!isBuildProgressDebugEnabled()) return;
    const mappedExists = progress !== null;
    const unifiedExists = unifiedProgress !== null;
    const stageTotals = mappedExists
      ? JSON.stringify(progress?.stageTotals)
      : undefined;
    const signature = JSON.stringify({
      progress,
      derivedStatus,
      error: error?.message ?? null,
    });
    if (signature === previousSignature.current) return;
    previousSignature.current = signature;
    logProgressMapping(nodeId, {
      unifiedExists,
      mappedExists,
      progressTaskId: progress?.progressTaskId ?? null,
      progressTaskStatus: progress?.progressTaskStatus ?? null,
      stageTotals,
    });
  }, [derivedStatus, error, nodeId, progress]);

  return {
    progress,
    status: derivedStatus,
    error,
    subscribe,
    unsubscribe,
  };
}
