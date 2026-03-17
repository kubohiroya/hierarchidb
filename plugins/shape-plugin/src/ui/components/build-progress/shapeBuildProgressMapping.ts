import type { BuildProgressPayload, BuildSessionStatus, BuildUnifiedProgressInfo, TaskDisplayPayload } from '@hierarchidb/build-api';
import { toBuildSessionStatusFromUnifiedProgress } from '@hierarchidb/ui-build-sessions';
import { computePercentage } from '@hierarchidb/ui-build-sessions';
import { normalizeUiStageId } from '~/ui/components/build-progress/stageIdAliases';

export interface BuildProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  stage?: string;
  timestamp?: number;
  message?: string | null;
  progressTaskId?: string;
  progressTaskStatus?: string;
  progressTaskStage?: string;
  progressTaskProgress?: number;
  progressTaskTitle?: string;
  progressTaskDisplay?: TaskDisplayPayload;
  stageTotals?: Partial<Record<'source' | 'geometry' | 'tileEmit', {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  }>>;
}

export interface BuildSessionDisplayStatus {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'queued';
  stage?: string;
  progress?: number;
  hasErrors?: boolean;
  error?: string | null;
  lastUpdated?: number;
}

export type ExtendedPayload = BuildProgressPayload & { stage?: string };

export type ExtendedProgress = BuildUnifiedProgressInfo & {
  payload?: ExtendedPayload & { skipped?: number };
};

type ProgressTaskMeta = {
  taskId?: unknown;
  status?: unknown;
  stage?: unknown;
  progress?: unknown;
  title?: unknown;
  display?: unknown;
};

type StageTotalsMeta = Partial<Record<'source' | 'geometry' | 'tileEmit', {
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
  Object.entries(stageTotals).forEach(([rawStageId, rawEntry]) => {
    const stageId = normalizeUiStageId(rawStageId);
    if (!stageId) return;
    const entry = asRecord(rawEntry);
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
  const payload = info.payload as (ExtendedPayload & { skipped?: number }) | undefined;
  if (!payload) {
    throw new Error(`[toShapeProgress] info.payload is required but was absent (nodeId=${String(info.nodeId)}, stage=${String(info.stage)})`);
  }
  if (typeof payload.total !== 'number' || !Number.isFinite(payload.total)) {
    throw new Error(`[toShapeProgress] payload.total must be a finite number, received ${String(payload.total)}`);
  }
  if (typeof payload.completed !== 'number' || !Number.isFinite(payload.completed)) {
    throw new Error(`[toShapeProgress] payload.completed must be a finite number, received ${String(payload.completed)}`);
  }
  if (typeof payload.failed !== 'number' || !Number.isFinite(payload.failed)) {
    throw new Error(`[toShapeProgress] payload.failed must be a finite number, received ${String(payload.failed)}`);
  }
  const total = payload.total;
  const completed = payload.completed;
  const failed = payload.failed;
  const skipped = payload.skipped ?? 0;
  const stage = info.stage;
  const percentage = computePercentage({ total, completed, failed, skipped });
  const progressTaskMeta = readProgressTaskMeta(info);
  const stageTotals = readStageTotalsMeta(info);
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    stage,
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
): BuildSessionDisplayStatus | null {
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
  const stage = mergedStatus.progress.stage;
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

export function mapPhaseToStatus(phase: string): BuildSessionDisplayStatus['status'] {
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
      return 'running';
  }
}
