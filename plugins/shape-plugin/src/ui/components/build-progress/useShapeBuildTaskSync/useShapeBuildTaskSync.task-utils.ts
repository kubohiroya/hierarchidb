import { isTaskSkipped } from '~/common/utils/taskMessageUtils';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import type { TileEmitParentInputSummary } from './useShapeBuildTaskSyncTypes.js';

const UNKNOWN_SCOPE_VALUE = 'unknown';
const TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY = 'tileEmitParentInputSummary';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const readNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const parseTopCountriesByIntersectingArea = (
  value: unknown
): Array<{ countryCode: string; intersectingAreaSqMeters: number }> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const record = row as Record<string, unknown>;
      const countryCode =
        typeof record.countryCode === 'string' ? record.countryCode.trim().toUpperCase() : '';
      const area = readNumber(record.intersectingAreaSqMeters);
      if (!/^[A-Z]{2}$/.test(countryCode) || area === null || area <= 0) return null;
      return {
        countryCode,
        intersectingAreaSqMeters: area,
      };
    })
    .filter((row): row is { countryCode: string; intersectingAreaSqMeters: number } => row !== null)
    .slice(0, 2);
};

export const readTileEmitParentInputSummary = (
  metadata: Record<string, unknown> | undefined
): TileEmitParentInputSummary | null => {
  const summaryRecord = asRecord(metadata?.[TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY]);
  if (!summaryRecord) return null;
  const parentTileRecord = asRecord(summaryRecord.parentTile);
  if (!parentTileRecord) return null;
  const z = readNumber(parentTileRecord.z);
  const x = readNumber(parentTileRecord.x);
  const y = readNumber(parentTileRecord.y);
  const intersectingFeatureCount = readNumber(summaryRecord.intersectingFeatureCount);
  const intersectingGeojsonByteSize = readNumber(summaryRecord.intersectingGeojsonByteSize);
  if (
    z === null ||
    x === null ||
    y === null ||
    intersectingFeatureCount === null ||
    intersectingGeojsonByteSize === null
  ) {
    return null;
  }
  return {
    parentTile: { z, x, y },
    intersectingFeatureCount: Math.max(0, Math.round(intersectingFeatureCount)),
    intersectingGeojsonByteSize: Math.max(0, Math.round(intersectingGeojsonByteSize)),
    topCountriesByIntersectingArea: parseTopCountriesByIntersectingArea(
      summaryRecord.topCountriesByIntersectingArea
    ),
  };
};

export const buildTileEmitParentInputSummaryMessage = (
  summary: TileEmitParentInputSummary
): string =>
  `tileEmit parent input z=${summary.parentTile.z} x=${summary.parentTile.x} y=${summary.parentTile.y}` +
  ` intersects(features=${summary.intersectingFeatureCount}, geojsonBytes=${summary.intersectingGeojsonByteSize})`;

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
  message?: string | null
): ShapeBuildTaskSummary['status'] => {
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new Error(`[ShapeBuildTaskSync] invalid progress (status): ${String(progress)}`);
  }
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
  display?: ShapeBuildTaskSummary['display'],
  message?: string | null,
  progress?: number
): ShapeBuildTaskSummary['progress'] => {
  if (
    typeof progress !== 'number' ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 100
  ) {
    throw new Error(`[ShapeBuildTaskSync] invalid progress (resolved): ${String(progress)}`);
  }
  if (status === 'completed' || status === 'failed' || isTaskSkipped(display, message)) {
    return 100;
  }
  if (status !== 'running' && progress >= 100) {
    throw new Error(
      `[ShapeBuildTaskSync] non-running task reached 100 progress: status=${String(status)}`
    );
  }
  return progress;
};

export const parseScopeFromTaskId = (
  taskId: string
): { iso2: string; adminLevel: string } | null => {
  const fetchMatch = taskId.match(/:source:([A-Za-z]{2,3}):(\d+)$/);
  if (fetchMatch?.[1] && fetchMatch[2]) {
    return {
      iso2: fetchMatch[1].trim().toUpperCase(),
      adminLevel: fetchMatch[2],
    };
  }
  const transformMatch = taskId.match(/:geometry:[^:]+:([A-Za-z]{2,3}):(\d+)$/);
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
