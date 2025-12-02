import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { Table } from 'dexie';
import type { LocationEntity, LocationDataSource, LocationDraft } from './LocationEntity.js';
import { clearLocationPoints } from '../../services/pointRepository.js';

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

export class LocationEntityHandler {
  private tableRef: Table<LocationEntity, NodeId, LocationEntity> | null;

  constructor(table?: Table<LocationEntity, NodeId, LocationEntity>) {
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
    return {
      id: entityId,
      nodeId,
      dataSource: data.dataSource,
      licenseAgreement: Boolean(data.licenseAgreement),
      licenseAgreedAt: data.licenseAgreement ? (data.licenseAgreedAt ?? Date.now() as Timestamp) : data.licenseAgreedAt,
      selectionMatrix: cloneMatrix(data.selectionMatrix),
      concurrentDownloads: data.concurrentDownloads ?? 2,
      batchSessionId: data.batchSessionId,
      lastProcessedAt: data.lastProcessedAt,
      processingStatus: 'pending',
    };
  }

  async createDraft(entity: LocationEntity): Promise<LocationDraft> {
    const draft = {
      ...entity,
      selectionMatrix: cloneMatrix(entity.selectionMatrix),
      features: entity.features ?? [],
      tabularSourceId: entity.tabularSourceId,
      extractConfig: entity.extractConfig,
    };

    const base = {
      treeNodeId: entity.nodeId,
      draft,
    };

    return { ...draft, ...base } as LocationDraft;
  }

  async createNewDraftBase(nodeId?: NodeId): Promise<LocationDraft> {
    const targetNodeId = nodeId ?? (crypto.randomUUID() as unknown as NodeId);

    const draft: Partial<LocationEntity> = {
      nodeId: targetNodeId,
      dataSource: 'openstreetmap',
      licenseAgreement: false,
      selectionMatrix: [],
      features: [],
      tabularSourceId: undefined,
      extractConfig: undefined,
      concurrentDownloads: 2,
      batchSessionId: undefined,
      lastProcessedAt: undefined,
      processingStatus: 'pending',
    };

    const base = {
      treeNodeId: targetNodeId,
      draft: draft as LocationEntity,
    };

    return { ...draft, ...base } as LocationDraft;
  }

  protected async cleanupEntityData(entity: LocationEntity): Promise<void> {
    await clearLocationPoints(entity.nodeId);
  }

  async updateDraft(
    treeNodeId: NodeId,
    updates: Partial<LocationEntity>,
  ): Promise<LocationDraft> {
    const existing = await this.table.get(treeNodeId);
    if (!existing) {
      throw new Error(`Location entity not found: ${treeNodeId}`);
    }

    const merged: LocationEntity = {
      ...existing,
      ...updates,
      selectionMatrix: cloneMatrix(updates.selectionMatrix ?? existing.selectionMatrix),
      features: updates.features ?? existing.features ?? [],
      tabularSourceId: updates.tabularSourceId ?? existing.tabularSourceId,
      extractConfig: updates.extractConfig ?? existing.extractConfig,
    };

    await this.table.put(merged, merged.nodeId);

    const base = {
      treeNodeId: merged.nodeId,
      draft: merged,
    };

    return { ...merged, ...base } as LocationDraft;
  }
}
