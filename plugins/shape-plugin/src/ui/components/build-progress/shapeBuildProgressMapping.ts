import type { BuildProgressPayload, BuildSessionStatus, BuildUnifiedProgressInfo, TaskDisplayPayload } from '@hierarchidb/batch-api';
import { toBuildSessionStatusFromUnifiedProgress } from '@hierarchidb/ui-batch-progress';
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
  progressTaskStatus?: string;
  progressTaskStage?: string;
  progressTaskProgress?: number;
  progressTaskTitle?: string;
  progressTaskDisplay?: TaskDisplayPayload;
  stageTotals?: Partial<Record<'fetch' | 'transform' | 'vt', {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  }>>;
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
  status?: unknown;
  stage?: unknown;
  progress?: unknown;
  title?: unknown;
  display?: unknown;
};

type StageTotalsMeta = Partial<Record<'fetch' | 'transform' | 'vt', {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
}>>;

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const readNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const readString = (value: unknown): string | undefined => (
  typeof value === 'string' && value.length > 0 ? value : undefined
);

const readTaskDisplay = (value: unknown): TaskDisplayPayload | undefined => {
  const display = asRecord(value);
  if (!display) return undefined;
  const kind = readString(display.kind);
  if (!kind) return undefined;
  if (kind !== 'phase' && kind !== 'summary' && kind !== 'skip' && kind !== 'error' && kind !== 'info') {
    return undefined;
  }
  return display as TaskDisplayPayload;
};

const readPayloadMeta = (info: ExtendedProgress): Record<string, unknown> | null => {
  return asRecord(info.payload?.meta);
};

const readProgressTaskMeta = (info: ExtendedProgress): ProgressTaskMeta | null => {
  const meta = readPayloadMeta(info);
  if (!meta) return null;
  const progressTask = asRecord(meta.progressTask);
  if (!progressTask) return null;
  return progressTask;
};

const readStageTotalsMeta = (info: ExtendedProgress): StageTotalsMeta | undefined => {
  const meta = readPayloadMeta(info);
  if (!meta) return undefined;
  const stageTotals = asRecord(meta.stageTotals);
  if (!stageTotals) return undefined;
  const result: StageTotalsMeta = {};
  (['fetch', 'transform', 'vt'] as const).forEach((stageId) => {
    const entry = asRecord(stageTotals[stageId]);
    if (!entry) return;
    const total = readNumber(entry.total);
    const completed = readNumber(entry.completed);
    const failed = readNumber(entry.failed);
    const skipped = readNumber(entry.skipped);
    if (total === undefined && completed === undefined && failed === undefined && skipped === undefined) return;
    result[stageId] = {
      total: total ?? 0,
      completed: completed ?? 0,
      failed: failed ?? 0,
      skipped: skipped ?? 0,
    };
  });
  return Object.keys(result).length > 0 ? result : undefined;
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
  const stageTotals = readStageTotalsMeta(info);
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
    progressTaskStatus: readString(progressTaskMeta?.status),
    progressTaskStage: readString(progressTaskMeta?.stage),
    progressTaskProgress: readNumber(progressTaskMeta?.progress),
    progressTaskTitle: readString(progressTaskMeta?.title),
    progressTaskDisplay: readTaskDisplay(progressTaskMeta?.display),
    stageTotals,
  };
}

export function toShapeStatus(
  info: ExtendedProgress | null,
  fallback?: BuildSessionStatus | null,
): BuildProgressStatus | null {
  const nodeId = info?.nodeId ?? fallback?.nodeId;
  if (!nodeId) return null;
  const mergedStatus = toBuildSessionStatusFromUnifiedProgress({
    nodeId,
    info,
    fallback,
  });
  if (!mergedStatus) return null;

  const status = mapPhaseToStatus(mergedStatus.status);
  const error = mergedStatus.error ?? null;
  const progress = mergedStatus.progress.percentage;
  const stage = mergedStatus.progress.taskType ?? info?.payload?.stage;
  const hasErrors = status === 'failed' || Boolean(error);
  return {
    status,
    stage,
    progress,
    hasErrors,
    error,
    lastUpdated: mergedStatus.lastActivity ?? Date.now(),
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
