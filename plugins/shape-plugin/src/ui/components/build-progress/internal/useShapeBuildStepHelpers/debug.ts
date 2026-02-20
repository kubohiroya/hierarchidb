import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';

export type ShapeProgressStepDebugConfig = Partial<Record<'progress' | 'all', boolean>>;

type ShapeProgressStepDebugScope = typeof globalThis & {
  __HDB_SHAPE_PROGRESS_STEP_DEBUG__?: unknown;
};

const isDev = import.meta.env.DEV;

export const readShapeProgressStepDebugConfig = (): ShapeProgressStepDebugConfig | null => {
  const scope = globalThis as ShapeProgressStepDebugScope;
  const raw = scope.__HDB_SHAPE_PROGRESS_STEP_DEBUG__;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as ShapeProgressStepDebugConfig;
};

export const isShapeProgressStepDebugEnabled = (): boolean => {
  if (!isDev) return false;
  const config = readShapeProgressStepDebugConfig();
  if (!config) return false;
  return config.all === true || config.progress === true;
};

export const emitShapeProgressStepTrace = (payload: ShapeProgressStepTracePayload): void => {
  if (!isDev) return;
  console.debug('[ShapeBuildProgressStepTrace]', payload);
};

export type ShapeProgressStepTracePayload = {
  nodeId: string | null;
  phase: BuildStatusSource;
  progressTaskId: string | null;
  progressTaskStatus: string | null;
  progressTaskStage: string | null;
  progressTaskProgress: number | null;
  percentage: number | null;
  total: number;
  completed: number;
  failed: number;
  message: string | null;
};
