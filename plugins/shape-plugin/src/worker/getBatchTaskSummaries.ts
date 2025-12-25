import type { BatchTaskSummary } from '@hierarchidb/common-api';
import { shapeDB, type BatchTaskRecord } from '../services/database/ShapeDB.js';

const toSummaryStatus = (status: BatchTaskRecord['status']): BatchTaskSummary['status'] => {
  if (status === 'waiting') return 'waiting';
  return status;
};

type ShapeBatchTaskSummary = BatchTaskSummary & {
  metadata?: Record<string, unknown>;
  title?: string;
};

const buildTaskTitle = (task: BatchTaskRecord): string | undefined => {
  const input = task.inputData ?? {};
  const getNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (task.taskType === 'download') {
    return (input.url as string | undefined) ?? (input.endpoint as string | undefined);
  }
  if (task.taskType === 'simplify1' || task.taskType === 'simplify2') {
    const sourceUrl = (input.sourceUrl ?? input.url) as string | undefined;
    const featureId = input.featureId as string | undefined;
    if (sourceUrl && featureId) return `${sourceUrl} • ${featureId}`;
    return sourceUrl ?? featureId;
  }
  if (task.taskType === 'vectortile') {
    const minZoom = getNumber(input.minZoom);
    const maxZoom = getNumber(input.maxZoom);
    const metadataContext = input.metadataContext as {
      dataSource?: string;
      countryCode?: string;
      countryName?: string;
      adminLevel?: number;
    } | undefined;
    const countryLabel = metadataContext?.countryName ?? metadataContext?.countryCode;
    const adminLabel = metadataContext?.adminLevel != null ? `ADM${metadataContext.adminLevel}` : undefined;
    const dataSourceLabel = metadataContext?.dataSource ? metadataContext.dataSource.toUpperCase() : undefined;
    const zoomLabel = typeof minZoom === 'number' && typeof maxZoom === 'number'
      ? `z${minZoom}-${maxZoom}`
      : undefined;
    const parts = [dataSourceLabel, countryLabel, adminLabel, zoomLabel].filter(Boolean);
    if (parts.length > 0) return parts.join(' • ');
    if (typeof minZoom === 'number' && typeof maxZoom === 'number') return `z${minZoom}-${maxZoom}`;
  }
  return undefined;
};

export async function getBatchTaskSummaries(sessionId: string): Promise<ShapeBatchTaskSummary[]> {
  const tasks = await shapeDB.getBatchTasks(sessionId);
  return tasks.map((task) => ({
    taskId: task.taskId,
    stage: task.taskType,
    status: toSummaryStatus(task.status),
    progress: task.progress ?? 0,
    message: task.message ?? task.errorMessage,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    metadata: task.inputData,
    title: buildTaskTitle(task),
  }));
}
