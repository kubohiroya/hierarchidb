/**
 * Shape Entity Service backed by TreeNode payloads (data/draftData + metadata/draftMetadata).
 * Aligns shape-plugin with the _obsolate_common Draft API flow (basemap-style).
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';
import type { DataSourceName } from '../../common/types/index.js';
import type {
  ShapeEntity,
} from '../../common/types/index.js';
import { CoreDB } from '@hierarchidb/runtime-worker';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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
    const hasDraft = (node as { draftData?: unknown }).draftData !== null &&
      typeof (node as { draftData?: unknown }).draftData !== 'undefined';
    const targetField = hasDraft ? 'draftData' : 'data';
    const targetValue = (node as { data?: unknown; draftData?: unknown })[targetField];
    if (isRecord(targetValue)) {
      return targetValue as ShapeEntity;
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
    const hasDraft = (node as { draftData?: unknown }).draftData !== null &&
      typeof (node as { draftData?: unknown }).draftData !== 'undefined';
    const targetField = hasDraft ? 'draftData' : 'data';
    const targetValue = (node as { data?: unknown; draftData?: unknown })[targetField];
    const payload = isRecord(targetValue)
      ? (targetValue as Record<string, unknown>)
      : {};
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
    const hasDraft = (node as { draftData?: unknown }).draftData !== null &&
      typeof (node as { draftData?: unknown }).draftData !== 'undefined';
    const targetField = hasDraft ? 'draftData' : 'data';
    const targetValue = (node as { data?: unknown; draftData?: unknown })[targetField];
    const payload = isRecord(targetValue)
      ? (targetValue as Record<string, unknown>)
      : {};
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
