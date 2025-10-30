import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { Table } from 'dexie';
import type { LocationEntity, LocationDataSource, LocationWorkingCopy } from './LocationEntity.js';
import { clearLocationPoints } from '../../services/pointRepository.js';
import { BaseSearchCriteria } from '@hierarchidb/plugin-service-api';
import { BaseEntityHandler, createDraftWorkingCopyBase } from '@hierarchidb/plugin-service-sdk';

export interface CreateLocationData {
  dataSource: LocationDataSource;
  selectionMatrix?: boolean[][];
  concurrentDownloads?: number;
  licenseAgreement?: boolean;
  licenseAgreedAt?: Timestamp;
  batchSessionId?: string;
  lastProcessedAt?: Timestamp;
}

function cloneMatrix(matrix?: boolean[][]): boolean[][] {
  return matrix ? matrix.map((row) => [...row]) : [];
}

export class LocationEntityHandler extends BaseEntityHandler<
  LocationEntity,
  CreateLocationData,
  BaseSearchCriteria
> {
  private tableRef: Table<LocationEntity, NodeId, LocationEntity> | null;

  constructor(table?: Table<LocationEntity, NodeId, LocationEntity>) {
    super();
    this.tableRef = table ?? null;
  }

  setTable(table: Table<LocationEntity, NodeId, LocationEntity>): void {
    this.tableRef = table;
  }

  protected get table(): Table<LocationEntity, NodeId, LocationEntity> {
    if (!this.tableRef) {
      throw new Error('LocationEntityHandler table is not initialized.');
    }
    return this.tableRef;
  }

  protected buildEntity(nodeId: NodeId, entityId: NodeId, data: CreateLocationData): LocationEntity {
    const now = Date.now() as Timestamp;

    return {
      id: entityId,
      nodeId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      dataSource: data.dataSource,
      licenseAgreement: Boolean(data.licenseAgreement),
      licenseAgreedAt: data.licenseAgreement ? (data.licenseAgreedAt ?? now) : data.licenseAgreedAt,
      selectionMatrix: cloneMatrix(data.selectionMatrix),
      concurrentDownloads: data.concurrentDownloads ?? 2,
      batchSessionId: data.batchSessionId,
      lastProcessedAt: data.lastProcessedAt,
      processingStatus: 'pending',
    };
  }

  async createWorkingCopy(entity: LocationEntity): Promise<LocationWorkingCopy> {
    const draft = {
      ...entity,
      selectionMatrix: cloneMatrix(entity.selectionMatrix),
    };

    const base = createDraftWorkingCopyBase<LocationEntity>({
      draft,
      meta: {
        treeNodeId: entity.nodeId,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        originalVersion: entity.version,
      },
    });

    return { ...draft, ...base } as LocationWorkingCopy;
  }

  async createNewDraftWorkingCopy(nodeId?: NodeId): Promise<LocationWorkingCopy> {
    const now = Date.now() as Timestamp;
    const targetNodeId = nodeId ?? (crypto.randomUUID() as unknown as NodeId);

    const draft: Partial<LocationEntity> = {
      nodeId: targetNodeId,
      dataSource: 'openstreetmap',
      licenseAgreement: false,
      selectionMatrix: [],
      concurrentDownloads: 2,
      batchSessionId: undefined,
      lastProcessedAt: undefined,
      createdAt: now,
      updatedAt: now,
      version: 1,
      processingStatus: 'pending',
    };

    const base = createDraftWorkingCopyBase<LocationEntity>({
      draft: draft as LocationEntity,
      meta: {
        treeNodeId: targetNodeId,
        createdAt: now,
        updatedAt: now,
      },
    });

    return { ...draft, ...base } as LocationWorkingCopy;
  }

  protected async cleanupEntityData(entity: LocationEntity): Promise<void> {
    await clearLocationPoints(entity.nodeId);
  }

  async updateWorkingCopy(
    treeNodeId: NodeId,
    updates: Partial<LocationEntity>,
  ): Promise<LocationWorkingCopy> {
    const existing = await this.table.get(treeNodeId);
    if (!existing) {
      throw new Error(`Location entity not found: ${treeNodeId}`);
    }

    const updatedAt = Date.now() as Timestamp;
    const merged: LocationEntity = {
      ...existing,
      ...updates,
      selectionMatrix: cloneMatrix(updates.selectionMatrix ?? existing.selectionMatrix),
      updatedAt,
    };

    await this.table.put(merged, merged.nodeId);

    const base = createDraftWorkingCopyBase<LocationEntity>({
      draft: merged,
      meta: {
        treeNodeId: merged.nodeId,
        createdAt: merged.createdAt,
        updatedAt: merged.updatedAt,
        originalVersion: merged.version,
      },
    });

    return { ...merged, ...base } as LocationWorkingCopy;
  }
}
