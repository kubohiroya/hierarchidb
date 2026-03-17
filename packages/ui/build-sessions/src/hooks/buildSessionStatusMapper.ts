import type { NodeId } from '@hierarchidb/core-types';
import type { BuildProgress, BuildProgressPayload, BuildSessionStatus, BuildUnifiedProgressInfo } from '../../../../build-api';
import { computePercentage } from '../utils/taskProgressSummary.js';

type UnifiedProgressInfoLike = BuildUnifiedProgressInfo & {
  payload?: BuildProgressPayload & {
    skipped?: number;
    estimatedTimeRemaining?: number;
  };
};

export type BuildSessionStatusFromUnifiedOptions = {
  nodeId: NodeId;
  info: BuildUnifiedProgressInfo | null;
  fallback?: BuildSessionStatus | null;
};

const readNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const assertFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[buildSessionStatusMapper] ${label} must be a finite number, received ${String(value)}`);
  }
  return value;
};

const normalizeToProgressNumber = (value: number | undefined, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const readOptionalNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const resolvePayloadCounts = (
  info: BuildUnifiedProgressInfo | null,
  fallback: BuildSessionStatus | null | undefined,
): { total: number; completed: number; failed: number } => {
  if (!info) {
    return {
      total: normalizeToProgressNumber(readNumber(fallback?.progress?.total), 0),
      completed: normalizeToProgressNumber(readNumber(fallback?.progress?.completed), 0),
      failed: normalizeToProgressNumber(readNumber(fallback?.progress?.failed), 0),
    };
  }
  const payload = info.payload as BuildProgressPayload | undefined;
  if (!payload) {
    throw new Error(`[buildSessionStatusMapper] info.payload is required but was absent (nodeId=${String(info.nodeId)}, stage=${String(info.stage)})`);
  }
  return {
    total: assertFiniteNumber(payload.total, 'payload.total'),
    completed: assertFiniteNumber(payload.completed, 'payload.completed'),
    failed: assertFiniteNumber(payload.failed, 'payload.failed'),
  };
};

export const toBuildSessionStatusFromUnifiedProgress = ({
  nodeId,
  info,
  fallback,
}: BuildSessionStatusFromUnifiedOptions): BuildSessionStatus | null => {
  const phase = info?.phase ?? fallback?.status;
  if (!phase) return null;

  const { total, completed, failed } = resolvePayloadCounts(info, fallback);

  const skipped = normalizeToProgressNumber(
    readNumber((info as UnifiedProgressInfoLike | null)?.payload?.skipped),
    normalizeToProgressNumber(readNumber(fallback?.progress?.skipped), 0),
  );
  const percentage = computePercentage({
    total,
    completed,
    failed,
    skipped,
  });

  const progress: BuildProgress = {
    total,
    completed,
    failed,
    skipped,
    percentage,
    stage: info?.stage ?? fallback?.progress?.stage ?? 'source',
    estimatedTimeRemaining: readOptionalNumber((info as UnifiedProgressInfoLike | null)?.payload?.estimatedTimeRemaining)
      ?? fallback?.progress?.estimatedTimeRemaining,
  };

  return {
    nodeId,
    status: phase,
    progress,
    startedAt: fallback?.startedAt,
    completedAt: fallback?.completedAt,
    lastActivity: typeof info?.timestamp === 'number' && Number.isFinite(info.timestamp)
      ? info.timestamp
      : fallback?.lastActivity,
    error: (typeof info?.message === 'string'
      ? info.message
      : undefined)
      ?? fallback?.error,
  };
};

export const areBuildSessionStatusesEquivalent = (
  left: BuildSessionStatus,
  right: BuildSessionStatus,
): boolean => (
  left.nodeId === right.nodeId
  && left.status === right.status
  && left.lastActivity === right.lastActivity
  && left.startedAt === right.startedAt
  && left.completedAt === right.completedAt
  && left.error === right.error
  && left.progress.total === right.progress.total
  && left.progress.completed === right.progress.completed
  && left.progress.failed === right.progress.failed
  && left.progress.skipped === right.progress.skipped
  && left.progress.percentage === right.progress.percentage
  && left.progress.stage === right.progress.stage
);
