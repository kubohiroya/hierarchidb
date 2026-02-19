/**
 * Shape Entity Service backed by TreeNode payloads (data/draftData + metadata/draftMetadata).
 * Aligns shape-plugin with the _obsolate_common Draft API flow (basemap-style).
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';
import type { DataSourceName } from '~/common/types/index';
import type {
  ShapeEntity,
  ShapePreviewMapView,
  ShapeStageTimingSnapshot,
  SelectedArrayByCountries,
} from '~/common/types/index';
import type { ShapeBuildConfig } from '~/common/types/build';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import { CoreDB } from '@hierarchidb/runtime-worker';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

const isString = (value: unknown): value is string =>
  typeof value === 'string';

const getString = (record: Record<string, unknown>, key: string): string | undefined =>
  isString(record[key]) ? record[key] : undefined;

const getNumber = (record: Record<string, unknown>, key: string): number | undefined =>
  isNumber(record[key]) ? record[key] : undefined;

const getBoolean = (record: Record<string, unknown>, key: string): boolean | undefined =>
  isBoolean(record[key]) ? record[key] : undefined;


const isShapeBuildConfig = (value: unknown): value is ShapeBuildConfig =>
  isRecord(value) && isString(value.dataSourceName);

const isShapeBuildStopReason = (value: unknown): value is ShapeBuildStopReason =>
  isString(value);

const isProcessingStatus = (
  value: unknown,
): value is 'idle' | 'processing' | 'paused' | 'completed' | 'failed' =>
  isString(value) && ['idle', 'processing', 'paused', 'completed', 'failed'].includes(value);

const isPreviewMapView = (value: unknown): value is ShapePreviewMapView => {
  if (!isRecord(value)) return false;
  return isNumber(value.longitude) && isNumber(value.latitude) && isNumber(value.zoom);
};

const isSelectedArrayByCountries = (value: unknown): value is SelectedArrayByCountries => {
  if (!isRecord(value)) return false;
  return Object.values(value).every(
    (entry) => Array.isArray(entry) && entry.every((flag) => isBoolean(flag))
  );
};

const isNumberRecord = (value: unknown): value is Record<string, number> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isNumber(entry));
};

const isStageTimingSnapshot = (value: unknown): value is ShapeStageTimingSnapshot => {
  if (!isRecord(value)) return false;
  if (!isNumber(value.startedAt)) return false;
  if (!isNumber(value.inactiveMs)) return false;
  if (value.lastHeartbeatAt !== undefined && !isNumber(value.lastHeartbeatAt)) return false;
  if (value.endedAt !== undefined && !isNumber(value.endedAt)) return false;
  return true;
};

const isStageTimingByStage = (value: unknown): value is Record<string, ShapeStageTimingSnapshot> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isStageTimingSnapshot(entry));
};

const toShapeEntity = (record: Record<string, unknown>, node: {
  id: NodeId;
  createdAt: number;
  updatedAt: number;
  version: number;
}): ShapeEntity => {
  const buildConfigValue = record.buildConfig;
  const selectedArrayByCountriesValue = record.selectedArrayByCountries;
  const previewMapViewValue = record.previewMapView;

  return {
    id: node.id,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    version: node.version,
    licenseAgreement: getBoolean(record, 'licenseAgreement'),
    licenseAgreedAt: getString(record, 'licenseAgreedAt'),
    buildConfig: isShapeBuildConfig(buildConfigValue) ? buildConfigValue : undefined,
    selectedArrayByCountries: isSelectedArrayByCountries(selectedArrayByCountriesValue)
      ? selectedArrayByCountriesValue
      : undefined,
    processingStatus: isProcessingStatus(record.processingStatus) ? record.processingStatus : undefined,
    stopReason: isShapeBuildStopReason(record.stopReason) ? record.stopReason : undefined,
    buildStartedAt: getNumber(record, 'buildStartedAt'),
    buildFinishedAt: getNumber(record, 'buildFinishedAt'),
    buildElapsedMs: getNumber(record, 'buildElapsedMs'),
    buildResumedAt: getNumber(record, 'buildResumedAt'),
    stageElapsedMs: getNumber(record, 'stageElapsedMs'),
    stageResumedAt: getNumber(record, 'stageResumedAt'),
    stageElapsedStageId: getString(record, 'stageElapsedStageId'),
    stageElapsedByStage: isNumberRecord(record.stageElapsedByStage) ? record.stageElapsedByStage : undefined,
    stageTimingByStage: isStageTimingByStage(record.stageTimingByStage) ? record.stageTimingByStage : undefined,
    previewMapView: isPreviewMapView(previewMapViewValue) ? previewMapViewValue : undefined,
  };
};

export type CreateShapeData = TreeNodeUpdaterPayload<ShapeEntity>;

export interface ShapeFilterCriteria {
  name?: string;
  dataSource?: DataSourceName;
  processingStatus?: string;
  hasActiveBatch?: boolean;
}

export class ShapeEntityService {
  private coreDBPromise: Promise<CoreDB>;

  constructor(coreDB?: CoreDB) {
    this.coreDBPromise = coreDB ? Promise.resolve(coreDB) : CoreDB.getSingleton();
  }

  private async ensureCoreDB(): Promise<CoreDB> {
    return this.coreDBPromise;
  }

  async getEntity(nodeId: NodeId): Promise<ShapeEntity | null> {
    const coreDB = await this.ensureCoreDB();
    const node = await coreDB.getNode(nodeId);
    if (!node) {
      return null;
    }
    const hasDraft = typeof (node as { draftData?: unknown }).draftData !== 'undefined';
    const targetField = hasDraft ? 'draftData' : 'data';
    const targetValue = (node as { data?: unknown; draftData?: unknown })[targetField];
    if (isRecord(targetValue)) {
      return toShapeEntity(targetValue, node);
    }
    return null;
  }

  async updateEntity(
    nodeId: NodeId,
    updates: Partial<ShapeEntity>,
  ): Promise<void> {
    const coreDB = await this.ensureCoreDB();
    const node = await coreDB.getNode(nodeId);
    if (!node) {
      throw new Error(`TreeNode not found: ${nodeId}`);
    }
    const hasDraft = typeof (node as { draftData?: unknown }).draftData !== 'undefined';
    const targetField = hasDraft ? 'draftData' : 'data';
    const targetValue = (node as { data?: unknown; draftData?: unknown })[targetField];
    const payload = isRecord(targetValue) ? targetValue : {};
    const updated = {
      ...payload,
      ...updates,
    };
    await coreDB.updateNode({
      id: nodeId,
      [targetField]: updated,
    });
  }

  async updateProcessingStatus(
    nodeId: NodeId,
    status: 'idle' | 'processing' | 'completed' | 'failed',
    batchSessionId?: string,
  ): Promise<void> {
    const coreDB = await this.ensureCoreDB();
    const node = await coreDB.getNode(nodeId);
    if (!node) {
      throw new Error(`TreeNode not found: ${nodeId}`);
    }
    const hasDraft = typeof (node as { draftData?: unknown }).draftData !== 'undefined';
    const targetField = hasDraft ? 'draftData' : 'data';
    const targetValue = (node as { data?: unknown; draftData?: unknown })[targetField];
    const payload = isRecord(targetValue) ? targetValue : {};
    const updated = {
      ...payload,
      processingStatus: status,
      ...(batchSessionId !== undefined ? { batchSessionId } : {}),
    };
    await coreDB.updateNode({
      id: nodeId,
      [targetField]: updated,
    });
  }

  async getProcessingStats(nodeId: NodeId): Promise<{
    featureCount: number;
    tileCount: number;
    storageUsed: number;
    lastProcessed?: number;
  }> {
    console.debug('[shapeEntityService] getProcessingStats not implemented; returning defaults', {
      nodeId,
    });
    return {
      featureCount: 0,
      tileCount: 0,
      storageUsed: 0,
    };
  }
}

export { ShapeEntityService as ShapeEntityHandler };
