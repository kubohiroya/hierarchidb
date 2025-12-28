import type {
  BatchProgressPayload,
  BatchSessionStatus,
  UnifiedProgressInfo,
} from '@hierarchidb/common-api';

export interface ShapeProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentStage?: string;
  currentTask?: string;
  timestamp?: number;
  message?: string | null;
}

export interface ShapeProgressStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'queued';
  stage?: string;
  progress?: number;
  hasErrors?: boolean;
  error?: string | null;
  lastUpdated?: number;
}

export type ExtendedPayload = BatchProgressPayload & { stage?: string; currentTask?: string };

export type ExtendedProgress = UnifiedProgressInfo & {
  phase?: string;
  timestamp?: number;
  message?: string | null;
  payload?: ExtendedPayload;
};

export function toShapeProgress(info: ExtendedProgress | null, sessionId?: string): ShapeProgress | null {
  if (!info) return null;
  const total = info.total ?? info.payload?.total ?? 0;
  const completed = info.completed ?? info.payload?.completed ?? 0;
  const failed = info.failed ?? info.payload?.failed ?? 0;
  const skipped = info.payload?.skipped ?? 0;
  const percentage = typeof info.percentage === 'number' && Number.isFinite(info.percentage)
    ? info.percentage
    : total > 0
      ? Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
      : 0;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    currentStage: info.stage ?? info.payload?.stage,
    currentTask: info.currentTask ?? info.message ?? info.payload?.currentTask ?? sessionId,
    timestamp: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    message: info.message ?? undefined,
  };
}

export function toShapeStatus(
  info: ExtendedProgress | null,
  fallback?: BatchSessionStatus | null,
): ShapeProgressStatus | null {
  const phase = info?.phase ?? fallback?.status;
  if (!phase) return null;
  const status = mapPhaseToStatus(phase);
  const error = fallback?.error ?? info?.message ?? null;
  const progress = info?.percentage ?? fallback?.progress?.percentage;
  const hasErrors = status === 'failed' || Boolean(error);
  return {
    status,
    stage: info?.stage ?? info?.payload?.stage ?? fallback?.progress?.currentStage,
    progress: typeof progress === 'number' ? progress : undefined,
    hasErrors,
    error,
    lastUpdated: info?.timestamp ?? fallback?.lastActivity ?? Date.now(),
  };
}

export function mapPhaseToStatus(phase: string): ShapeProgressStatus['status'] {
  switch (phase) {
    case 'idle':
      return 'idle';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'paused':
      return 'paused';
    case 'queued':
      return 'queued';
    default:
      return 'processing';
  }
}

export function statusToUnified(status: BatchSessionStatus): UnifiedProgressInfo {
  const progress = status.progress;
  const total = numeric(progress.total);
  const completed = numeric(progress.completed);
  const failed = numeric(progress.failed);
  const skipped = numeric(progress.skipped);
  const percentage = numeric(progress.percentage, total > 0 ? Math.round((completed / total) * 100) : 0);
  const fallbackStage = status.status === 'idle' ? 'idle' : 'processing';
  return {
    stage: progress.currentStage ?? fallbackStage,
    total,
    completed,
    failed,
    percentage,
    currentTask: progress.currentTask ?? progress.currentStage ?? fallbackStage,
    phase: mapPhaseToStatus(status.status),
    timestamp: status.lastActivity ?? Date.now(),
    payload: {
      total,
      completed,
      failed,
      skipped,
      currentTask: progress.currentTask ?? progress.currentStage ?? fallbackStage,
      meta: status.error ? { errors: [status.error] } : undefined,
    },
    message: status.error,
    nodeId: status.nodeId,
    sessionId: status.sessionId,
  };
}

function numeric(value: number | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}
