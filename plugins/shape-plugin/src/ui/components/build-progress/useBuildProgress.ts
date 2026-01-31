import type { NodeType } from '@hierarchidb/core-types';
import { usePluginBatchProgress } from '@hierarchidb/ui-batch-progress';
import {
  toShapeProgress,
  toShapeStatus,
  type ExtendedProgress,
  type BuildProgress,
  type BuildProgressStatus,
} from './shapeBuildProgressMapping.ts';

export type { BuildProgress, BuildProgressStatus };

export interface ShapeProgressState {
  progress: BuildProgress | null;
  status: BuildProgressStatus | null;
  error: Error | null;
}

export interface UseBuildProgressOptions {
  autoSubscribe?: boolean;
}

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
    error,
    subscribe,
    unsubscribe,
  } = usePluginBatchProgress<BuildProgress, BuildProgressStatus>(
    SHAPE_NODE_TYPE,
    nodeId,
    {
      autoSubscribe,
      mapUnifiedToProgress: (info) => toShapeProgress(info as ExtendedProgress | null),
      mapUnifiedToStatus: (info) => toShapeStatus(info as ExtendedProgress | null),
    },
  );
  const debugKey = nodeId ?? 'none';
  const debugSnapshot = {
    nodeId,
    error: error?.message ?? null,
    status: derivedStatus?.status ?? null,
    progress: progress?.percentage ?? null,
    taskType: progress?.taskType ?? null,
  };

  if (typeof window !== 'undefined') {
    const lastKey = `__shapeProgressDebug_${debugKey}`;
    const prev = (window as unknown as Record<string, unknown>)[lastKey] as typeof debugSnapshot | undefined;
    const changed = !prev || Object.keys(debugSnapshot).some((key) => prev[key as keyof typeof debugSnapshot] !== debugSnapshot[key as keyof typeof debugSnapshot]);
    if (changed) {
      console.debug('[ShapeBuildStep] progressState', debugSnapshot);
      (window as unknown as Record<string, unknown>)[lastKey] = debugSnapshot;
    }
  }

  return {
    progress,
    status: derivedStatus,
    error,
    subscribe,
    unsubscribe,
  };
}
