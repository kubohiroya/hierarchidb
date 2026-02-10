import type { BuildProgressPayload, BuildSessionStatus, BuildUnifiedProgressInfo } from '@hierarchidb/batch-api';
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
  progressTaskId?: string;
  progressTaskSequence?: number;
  progressTaskStatus?: string;
  progressTaskStage?: string;
  progressTaskProgress?: number;
}

export interface BuildProgressStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'paused' | 'queued';
  stage?: string;
  progress?: number;
  hasErrors?: boolean;
  error?: string | null;
  lastUpdated?: number;
}

export type ExtendedPayload = BuildProgressPayload & { stage?: string };

export type ExtendedProgress = BuildUnifiedProgressInfo & {
  phase?: string;
  timestamp?: number;
  message?: string | null;
  payload?: ExtendedPayload;
};

type ProgressTaskMeta = {
  taskId?: unknown;
  sequence?: unknown;
  status?: unknown;
  stage?: unknown;
  progress?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const readString = (value: unknown): string | undefined => (
  typeof value === 'string' && value.length > 0 ? value : undefined
);

const readProgressTaskMeta = (info: ExtendedProgress): ProgressTaskMeta | null => {
  const meta = asRecord(info.payload?.meta);
  if (!meta) return null;
  const progressTask = asRecord(meta.progressTask);
  if (!progressTask) return null;
  return progressTask;
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
  const progressTaskMeta = readProgressTaskMeta(info);
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    taskType,
    timestamp: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    message: info.message ?? undefined,
    progressTaskId: readString(progressTaskMeta?.taskId),
    progressTaskSequence: readNumber(progressTaskMeta?.sequence),
    progressTaskStatus: readString(progressTaskMeta?.status),
    progressTaskStage: readString(progressTaskMeta?.stage),
    progressTaskProgress: readNumber(progressTaskMeta?.progress),
  };
}

export function toShapeStatus(
  info: ExtendedProgress | null,
  fallback?: BuildSessionStatus | null,
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
