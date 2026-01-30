import type { BatchProgressPayload, BatchSessionStatus, UnifiedProgressInfo } from '@hierarchidb/batch-api';
import { computePercentage } from '@hierarchidb/ui-batch-progress';

export interface BuildProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  taskType?: string;
  timestamp?: number;
  message?: string | null;
}

export interface BuildProgressStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'paused' | 'queued';
  stage?: string;
  progress?: number;
  hasErrors?: boolean;
  error?: string | null;
  lastUpdated?: number;
}

export type ExtendedPayload = BatchProgressPayload & { stage?: string };

export type ExtendedProgress = UnifiedProgressInfo & {
  phase?: string;
  timestamp?: number;
  message?: string | null;
  payload?: ExtendedPayload;
};

export function toShapeProgress(info: ExtendedProgress | null): BuildProgress | null {
  if (!info) return null;
  const total = info.total ?? info.payload?.total ?? 0;
  const completed = info.completed ?? info.payload?.completed ?? 0;
  const failed = info.failed ?? info.payload?.failed ?? 0;
  const skipped = info.payload?.skipped ?? 0;
  const taskType = info.stage ?? info.payload?.stage;
  const percentage = typeof info.percentage === 'number' && Number.isFinite(info.percentage)
    ? info.percentage
    : Math.max(0, Math.min(100, computePercentage({ total, completed, failed, skipped })));
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    taskType,
    timestamp: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    message: info.message ?? undefined,
  };
}

export function toShapeStatus(
  info: ExtendedProgress | null,
  fallback?: BatchSessionStatus | null,
): BuildProgressStatus | null {
  const fallbackStatus = fallback?.status;
  const phase = fallbackStatus && fallbackStatus !== 'idle'
    ? fallbackStatus
    : info?.phase ?? fallbackStatus;
  if (!phase) return null;
  const status = mapPhaseToStatus(phase);
  const error = fallback?.error ?? info?.message ?? null;
  const progress = info?.percentage ?? fallback?.progress?.percentage;
  const hasErrors = status === 'failed' || Boolean(error);
  return {
    status,
    stage: info?.stage ?? info?.payload?.stage ?? fallback?.progress?.taskType,
    progress: typeof progress === 'number' ? progress : undefined,
    hasErrors,
    error,
    lastUpdated: info?.timestamp ?? fallback?.lastActivity ?? Date.now(),
  };
}

export function mapPhaseToStatus(phase: string): BuildProgressStatus['status'] {
  switch (phase) {
    case 'idle':
      return 'idle';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'paused':
      return 'paused';
    case 'queued':
      return 'queued';
    default:
      return 'processing';
  }
}
