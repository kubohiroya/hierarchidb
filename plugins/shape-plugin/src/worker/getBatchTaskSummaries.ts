import type { BatchTaskSummary } from '@hierarchidb/common-api';
import { getShapeDbApiClient } from '../services/batch/ShapeBatchApiClient.js';
import type { BatchTaskRecord } from '../services/database/ShapeDB.js';

const toSummaryStatus = (status: BatchTaskRecord['status']): BatchTaskSummary['status'] => {
  if (status === 'waiting') return 'waiting';
  return status;
};

type ShapeBatchTaskSummary = BatchTaskSummary & {
  title?: string;
};

const buildTaskTitle = (task: BatchTaskRecord): string | undefined => {
  const input = (task.inputData ?? {}) as Record<string, unknown>;
  const getNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const getString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  const countryCode = getString(input.countryCode ?? input.country)?.toUpperCase();
  const adminLevel = getNumber(input.adminLevel);
  const locationTitle = countryCode && typeof adminLevel === 'number'
    ? `${countryCode}/${adminLevel}`
    : undefined;
  const countryLabel = getString(input.countryName) ?? countryCode;
  const featureLabel = getString(input.featureLabel)
    ?? getString(input.featureGroupId)
    ?? getString(input.originLabel);
  const buildRegionLabel = (country?: string, feature?: string): string | undefined => {
    if (!country && !feature) return undefined;
    if (!country) return feature;
    if (!feature) return country;
    const countryLower = country.toLowerCase();
    const featureLower = feature.toLowerCase();
    if (featureLower.includes(countryLower)) return feature;
    return `${country}/${feature}`;
  };
  const regionLabel = buildRegionLabel(countryLabel, featureLabel);
  const buildZoomRangeLabel = (): string | undefined => {
    const rawLabel = getString(input.zoomRangeLabel);
    if (rawLabel) return rawLabel;
    const zoomRange = Array.isArray(input.zoomRange) ? input.zoomRange : undefined;
    if (!zoomRange || zoomRange.length !== 2) return undefined;
    const minZoom = getNumber(zoomRange[0]);
    const maxZoom = getNumber(zoomRange[1]);
    if (typeof minZoom !== 'number' || typeof maxZoom !== 'number') return undefined;
    return `z${minZoom}-${maxZoom}`;
  };
  if (task.taskType === 'download') {
    return locationTitle ?? getString(input.url) ?? getString(input.endpoint);
  }
  if (task.taskType === 'extract1' || task.taskType === 'extract2') {
    if (task.taskType === 'extract1') {
      const parts = [locationTitle, regionLabel].filter(Boolean);
      return parts.length > 0 ? parts.join(' | ') : locationTitle ?? regionLabel;
    }
    const zoomRangeLabel = buildZoomRangeLabel();
    const parts = [locationTitle, regionLabel, zoomRangeLabel].filter(Boolean);
    return parts.length > 0 ? parts.join(' | ') : locationTitle ?? regionLabel ?? zoomRangeLabel;
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
  const tasks = await getShapeDbApiClient().ephemeral.listBatchTasks(nodeId as BatchTaskRecord['nodeId']);
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
