import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { VtParentInputSummary } from './useShapeBuildTaskSync.types.js';
import { isTaskSkipped } from '~/common/utils/taskMessages';

const UNKNOWN_SCOPE_VALUE = 'unknown';
const VT_PARENT_INPUT_SUMMARY_METADATA_KEY = 'vtParentInputSummary';

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export const readVtParentInputSummary = (metadata: Record<string, unknown> | undefined): VtParentInputSummary | null => {
  const summaryRecord = asRecord(metadata?.[VT_PARENT_INPUT_SUMMARY_METADATA_KEY]);
  if (!summaryRecord) return null;
  const parentTileRecord = asRecord(summaryRecord.parentTile);
  if (!parentTileRecord) return null;
  const z = readNumber(parentTileRecord.z);
  const x = readNumber(parentTileRecord.x);
  const y = readNumber(parentTileRecord.y);
  const intersectingFeatureCount = readNumber(summaryRecord.intersectingFeatureCount);
  const intersectingGeojsonByteSize = readNumber(summaryRecord.intersectingGeojsonByteSize);
  if (z === null || x === null || y === null || intersectingFeatureCount === null || intersectingGeojsonByteSize === null) {
    return null;
  }
  return {
    parentTile: { z, x, y },
    intersectingFeatureCount: Math.max(0, Math.round(intersectingFeatureCount)),
    intersectingGeojsonByteSize: Math.max(0, Math.round(intersectingGeojsonByteSize)),
  };
};

export const buildVtParentInputSummaryMessage = (summary: VtParentInputSummary): string => (
  `vt parent input z=${summary.parentTile.z} x=${summary.parentTile.x} y=${summary.parentTile.y}`
  + ` intersects(features=${summary.intersectingFeatureCount}, geojsonBytes=${summary.intersectingGeojsonByteSize})`
);

export const mergeTaskMessage = (base: string | undefined, addition: string): string => {
  const trimmedBase = typeof base === 'string' ? base.trim() : '';
  if (trimmedBase.length === 0) return addition;
  if (trimmedBase.includes(addition)) return trimmedBase;
  return `${trimmedBase} | ${addition}`;
};

export const resolveTaskDisplayStatus = (
  status: ShapeBuildTaskSummary['status'] | undefined,
  progress: number,
  display?: ShapeBuildTaskSummary['display'],
  message?: ShapeBuildTaskSummary['message'],
): ShapeBuildTaskSummary['status'] => {
  const resolvedStatus = status ?? 'queued';
  if (resolvedStatus === 'running' && progress >= 100) {
    return 'completed';
  }
  if (resolvedStatus === 'running' && isTaskSkipped(display, message)) {
    return 'completed';
  }
  return resolvedStatus;
};

export const resolveTaskProgress = (
  status: ShapeBuildTaskSummary['status'],
  progress: number,
  display?: ShapeBuildTaskSummary['display'],
  message?: ShapeBuildTaskSummary['message'],
): ShapeBuildTaskSummary['progress'] => {
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  if (status === 'completed' || status === 'failed' || isTaskSkipped(display, message)) {
    return 100;
  }
  if (safeProgress >= 100) return 99;
  return Math.max(0, safeProgress);
};

export const parseScopeFromTaskId = (taskId: string): { iso2: string; adminLevel: string } | null => {
  const fetchMatch = taskId.match(/:fetch:([A-Za-z]{2,3}):(\d+)$/);
  if (fetchMatch?.[1] && fetchMatch[2]) {
    return {
      iso2: fetchMatch[1].trim().toUpperCase(),
      adminLevel: fetchMatch[2],
    };
  }
  const transformMatch = taskId.match(/:transform:[^:]+:([A-Za-z]{2,3}):(\d+)$/);
  if (transformMatch?.[1] && transformMatch[2]) {
    return {
      iso2: transformMatch[1].trim().toUpperCase(),
      adminLevel: transformMatch[2],
    };
  }
  return null;
};

export const resolveTaskScope = (task: ShapeBuildTaskSummary) => {
  const fromTaskId = parseScopeFromTaskId(task.taskId);
  if (fromTaskId) return fromTaskId;
  return {
    iso2: UNKNOWN_SCOPE_VALUE,
    adminLevel: UNKNOWN_SCOPE_VALUE,
  };
};
