import type { BatchTaskSummary } from '@hierarchidb/common-api';
import { shapeDB, type BatchTaskRecord } from '../services/database/ShapeDB.js';

const toSummaryStatus = (status: BatchTaskRecord['status']): BatchTaskSummary['status'] => {
  if (status === 'waiting') return 'waiting';
  return status;
};

type ShapeBatchTaskSummary = BatchTaskSummary & {
  title?: string;
};

const buildTaskTitle = (task: BatchTaskRecord): string | undefined => {
  const input = task.inputData ?? {};
  const getNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const countryCode = (input.countryCode ?? input.country) as string | undefined;
  const adminLevel = getNumber(input.adminLevel);
  const locationTitle = countryCode && typeof adminLevel === 'number'
    ? `${countryCode}/${adminLevel}`
    : undefined;
  if (task.taskType === 'download') {
    return locationTitle ?? (input.url as string | undefined) ?? (input.endpoint as string | undefined);
  }
  if (task.taskType === 'extract1' || task.taskType === 'extract2') {
    return locationTitle;
  }
  if (task.taskType === 'vectortile') {
    const tileZ = getNumber(input.tileZ);
    const tileX = getNumber(input.tileX);
    const tileY = getNumber(input.tileY);
    const featureLabel = (input.featureLabel ?? input.featureId) as string | undefined;
    if (typeof tileZ === 'number' && typeof tileX === 'number' && typeof tileY === 'number') {
      const tileLabel = `z${tileZ} / x${tileX} y${tileY}`;
      return featureLabel ? `${tileLabel} • ${featureLabel}` : tileLabel;
    }
    const minZoom = getNumber(input.minZoom);
    const maxZoom = getNumber(input.maxZoom);
    const countryLabel = (input.countryName ?? input.countryCode) as string | undefined;
    const adminLevel = getNumber(input.adminLevel);
    const adminLabel = adminLevel != null ? `ADM${adminLevel}` : undefined;
    const dataSourceLabel = typeof input.dataSource === 'string'
      ? input.dataSource.toUpperCase()
      : undefined;
    const zoomLabel = typeof minZoom === 'number' && typeof maxZoom === 'number'
      ? `z${minZoom}-${maxZoom}`
      : undefined;
    const parts = [dataSourceLabel, countryLabel, adminLabel, zoomLabel].filter(Boolean);
    if (parts.length > 0) return parts.join(' • ');
    if (typeof minZoom === 'number' && typeof maxZoom === 'number') return `z${minZoom}-${maxZoom}`;
  }
  return undefined;
};

export async function getBatchTaskSummaries(nodeId: string): Promise<ShapeBatchTaskSummary[]> {
  const tasks = await shapeDB.getBatchTasks(nodeId);
  return tasks.map((task) => ({
    taskId: task.taskId,
    stage: task.taskType,
    status: toSummaryStatus(task.status),
    progress: task.progress ?? 0,
    message: task.message ?? task.errorMessage,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    title: buildTaskTitle(task),
  }));
}
