/**
 * Shape Entity Service backed by TreeNode payloads (data/draftData + metadata/draftMetadata).
 * Aligns shape-plugin with the common Draft API flow (basemap-style).
 */

import type { TreeId, TreeNode, TreeNodeMetadata, TreeNodeUpdaterPayload } from '@hierarchidb/common-types';
import { toNodeType } from '@hierarchidb/common-types';
import type { DataSourceName, NodeId } from '../../common/shared/index.js';
import {
  buildShapeEntityFromCreate,
  createDraftFromEntity,
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  normalizeDataSourceName,
  parseCheckboxState,
  type ProcessingConfig,
  type ShapeEntity,
  type ShapeDraft,
} from '../../common/shared/index.js';
import { CoreDB } from '../../../../../packages/runtime-worker/src/services/CoreDB.js';
import {
  commitTreeNodeDraft,
  type CommitResult as DraftCommitResult,
} from '../../../../../packages/runtime-worker/src/services/draft/commitOperations.js';
import { discardTreeNodeDraft } from '../../../../../packages/runtime-worker/src/services/draft/cleanupOperations.js';
import {
  getTreeNode,
  updateTreeNodeDraftData,
  updateTreeNodeDraftMetadata,
} from '../../../../../packages/runtime-worker/src/services/draft/lookupOperations.js';
import { initTreeNode } from '../../../../../packages/runtime-worker/src/services/draft/initOperations.js';

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

  private async readNode(nodeId: NodeId): Promise<TreeNode | null> {
    const coreDB = await this.ensureCoreDB();
    return getTreeNode(coreDB, nodeId);
  }

  private toEntity(node: TreeNode | null): ShapeEntity | null {
    if (!node) return null;
    const payload = isRecord((node as { draftData?: unknown }).draftData)
      ? ((node as { draftData?: Record<string, unknown> }).draftData ?? {})
      : isRecord((node as { data?: unknown }).data)
        ? ((node as { data?: Record<string, unknown> }).data ?? {})
        : {};
    const payloadRecord = payload as Record<string, unknown>;
    const metadata = ((node as { metadata?: TreeNodeMetadata }).metadata ?? {}) as TreeNodeMetadata;
    const dataSource =
      normalizeDataSourceName((payloadRecord as { dataSourceName?: unknown }).dataSourceName as
        | DataSourceName
        | undefined) ?? 'naturalearth';
    const processingConfig = mergeProcessingConfig(
      (payloadRecord as { processingConfig?: ProcessingConfig }).processingConfig ??
        DEFAULT_PROCESSING_CONFIG,
    );
    const checkboxState = (payloadRecord as { checkboxState?: unknown }).checkboxState;
    const normalizedCheckbox =
      typeof checkboxState === 'string' || Array.isArray(checkboxState)
        ? checkboxState
        : [];

    return {
      ...(payloadRecord as Partial<ShapeEntity>),
      id: node.id as NodeId,
      metadata: {
        name: metadata.name ?? '',
        description: metadata.description ?? '',
        tags: metadata.tags ?? [],
      },
      dataSourceName: dataSource,
      processingConfig,
      licenseAgreement:
        typeof (payloadRecord as { licenseAgreement?: unknown }).licenseAgreement === 'boolean'
          ? (payloadRecord as { licenseAgreement?: boolean }).licenseAgreement!
          : false,
      checkboxState: normalizedCheckbox,
      batchSessionId: (payloadRecord as { batchSessionId?: string }).batchSessionId,
      processingStatus:
        (payloadRecord as { processingStatus?: ShapeEntity['processingStatus'] }).processingStatus ??
        'idle',
    };
  }

  private async writeDraft(
    nodeId: NodeId,
    payload: ShapeEntity,
    metadataPatch?: Partial<TreeNodeMetadata>,
  ): Promise<void> {
    const { version: _omitVersion, createdAt: _omitCreatedAt, updatedAt: _omitUpdatedAt, ...payloadWithoutVersion } =
      payload as ShapeEntity & { createdAt?: number; updatedAt?: number; version?: number };
    const coreDB = await this.ensureCoreDB();
    if (metadataPatch && Object.keys(metadataPatch).length > 0) {
      await updateTreeNodeDraftMetadata(coreDB, nodeId, metadataPatch);
    }
    await updateTreeNodeDraftData(coreDB, nodeId, payloadWithoutVersion as unknown as Record<string, unknown>);
  }

  private buildEntity(nodeId: NodeId, data: Partial<CreateShapeData>, base?: ShapeEntity): ShapeEntity {
    const mergedProcessing = mergeProcessingConfig(
      (data.draftData?.processingConfig as ProcessingConfig | undefined) ??
        base?.processingConfig ??
        DEFAULT_PROCESSING_CONFIG,
    );
    const dataSource =
      normalizeDataSourceName(
        (data.draftData as Partial<ShapeEntity> | undefined)?.dataSourceName ??
          base?.dataSourceName ??
          'naturalearth',
      ) ??
      'naturalearth';

    const metadata = data.draftMetadata ?? base?.metadata ?? { name: '', description: '', tags: [] };
    const draftData = (data.draftData as Partial<ShapeEntity> | undefined) ?? {};

    return {
      ...base,
      id: nodeId,
      metadata,
      dataSourceName: dataSource,
      licenseAgreement: base?.licenseAgreement ?? false,
      processingConfig: mergedProcessing,
      checkboxState: draftData.checkboxState ?? base?.checkboxState ?? [],
      batchSessionId: draftData.batchSessionId ?? base?.batchSessionId,
      processingStatus: draftData.processingStatus ?? base?.processingStatus ?? 'idle',
      selectedCountries: draftData.selectedCountries ?? base?.selectedCountries ?? [],
      adminLevels: draftData.adminLevels ?? base?.adminLevels ?? [],
      urlMetadata: draftData.urlMetadata ?? base?.urlMetadata ?? [],
      tabularMetadataId: draftData.tabularMetadataId ?? base?.tabularMetadataId,
      tabularFilters: draftData.tabularFilters ?? base?.tabularFilters,
    };
  }

  async getEntityByNodeId(nodeId: NodeId): Promise<ShapeEntity | null> {
    const node = await this.readNode(nodeId);
    return this.toEntity(node);
  }

  async createEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity> {
    const baseNode = await this.readNode(nodeId);
    if (!baseNode) {
      throw new Error(`TreeNode not found: ${String(nodeId)}`);
    }
    const current = this.toEntity(baseNode) ?? undefined;
    const entity = this.buildEntity(nodeId, data, current ?? undefined);
    await this.writeDraft(nodeId, entity, data.draftMetadata ?? baseNode.metadata);
    return entity;
  }

  async updateEntity(nodeId: NodeId, updates: Partial<CreateShapeData>): Promise<ShapeEntity> {
    const current = await this.getEntityByNodeId(nodeId);
    if (!current) {
      throw new Error(`Shape entity not found: ${nodeId}`);
    }
    const entity = this.buildEntity(nodeId, updates, current);
    await this.writeDraft(nodeId, entity, updates.draftMetadata ?? current.metadata);
    return entity;
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    const coreDB = await this.ensureCoreDB();
    const node = await this.readNode(nodeId);
    if (!node) return;
    await coreDB.updateNode({ id: nodeId, draftData: null, data: null, draftMetadata: null });
    await discardTreeNodeDraft(coreDB, nodeId);
  }

  async searchEntities(criteria: ShapeFilterCriteria): Promise<ShapeEntity[]> {
    const coreDB = await this.ensureCoreDB();
    const nodes = (await coreDB.nodes.where('nodeType').equals('shape').toArray()) as TreeNode[];
    const entities = nodes
      .map((node: TreeNode) => this.toEntity(node))
      .filter((entity): entity is ShapeEntity => !!entity);

    return entities.filter(entity => {
      if (criteria.name && !entity.metadata?.name?.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      if (criteria.dataSource && entity.dataSourceName !== criteria.dataSource) {
        return false;
      }
      if (criteria.processingStatus && entity.processingStatus !== criteria.processingStatus) {
        return false;
      }
      if (criteria.hasActiveBatch !== undefined) {
        const hasBatch = !!entity.batchSessionId;
        if (criteria.hasActiveBatch !== hasBatch) return false;
      }
      return true;
    });
  }

  async createDraft(nodeId: NodeId): Promise<ShapeDraft> {
    const baseNode = await this.readNode(nodeId);
    if (!baseNode) {
      throw new Error(`TreeNode not found: ${String(nodeId)}`);
    }
    const entity =
      this.toEntity(baseNode) ??
      buildShapeEntityFromCreate({
        treeNodeId: nodeId,
        data: {
          dataSourceName: 'naturalearth',
          processingConfig: DEFAULT_PROCESSING_CONFIG,
          metadata: baseNode.metadata ?? { name: '', description: '', tags: [] },
        },
      });
    await this.writeDraft(nodeId, entity, baseNode.metadata);
    return createDraftFromEntity(entity);
  }

  async createNewDraftBase(parentId: NodeId): Promise<ShapeDraft> {
    const coreDB = await this.ensureCoreDB();
    const treeId = (parentId.toString().split(':')[0] ?? 'r') as TreeId;
    const nodeType = toNodeType('shape');
    const baseName = 'New Shape';
    const wcId = await initTreeNode(coreDB, treeId, parentId, nodeType, baseName);
    const entity = buildShapeEntityFromCreate({
      treeNodeId: wcId,
      data: {
        dataSourceName: 'naturalearth',
        processingConfig: DEFAULT_PROCESSING_CONFIG,
        metadata: { name: baseName, description: '', tags: [] },
      },
    });
    await this.writeDraft(wcId, entity, { name: baseName, description: '', tags: [] });
    return createDraftFromEntity(entity);
  }

  async getDraft(draftId: NodeId): Promise<ShapeDraft | undefined> {
    const node = await this.readNode(draftId);
    const entity = this.toEntity(node);
    if (!entity) return undefined;
    return createDraftFromEntity(entity);
  }

  async updateDraft(draftId: NodeId, data: Partial<ShapeEntity>): Promise<ShapeDraft> {
    const current = await this.getEntityByNodeId(draftId);
    if (!current) {
      throw new Error(`Working copy not found: ${draftId}`);
    }
    const mergedCheckboxState =
      data.checkboxState !== undefined
        ? data.checkboxState
        : current.checkboxState ?? [];
    const mergedProcessing = mergeProcessingConfig(
      (data.processingConfig ?? current.processingConfig ?? DEFAULT_PROCESSING_CONFIG) as
        | Partial<ProcessingConfig>
        | ProcessingConfig,
    );
    const dataSource =
      normalizeDataSourceName(
        (data.dataSourceName ?? current.dataSourceName ?? 'naturalearth') as DataSourceName,
      ) ?? 'naturalearth';
    const updated: ShapeEntity = {
      ...current,
      ...data,
      dataSourceName: dataSource,
      processingConfig: mergedProcessing,
      checkboxState: Array.isArray(mergedCheckboxState) || typeof mergedCheckboxState === 'string'
        ? mergedCheckboxState
        : parseCheckboxState(mergedCheckboxState as any),
    };

    await this.writeDraft(draftId, updated, data.metadata ?? current.metadata);
    return createDraftFromEntity(updated);
  }

  async commitDraft(draftId: NodeId): Promise<void> {
    const coreDB = await this.ensureCoreDB();
    const result: DraftCommitResult = await commitTreeNodeDraft(coreDB, draftId, 'auto-rename');
    if (result.status === 'ok') return;
    if (result.status === 'NAME_CONFLICT') {
      throw new Error(`Name conflict: ${result.suggestedName}`);
    }
    throw new Error('Commit conflict');
  }

  async discardDraft(draftId: NodeId): Promise<void> {
    const coreDB = await this.ensureCoreDB();
    await discardTreeNodeDraft(coreDB, draftId);
  }

  async applyDraft(nodeId: NodeId, draft: ShapeDraft): Promise<ShapeEntity> {
    const parsedCheckbox =
      typeof draft.draftData?.checkboxState === 'string' || Array.isArray(draft.draftData?.checkboxState)
        ? draft.draftData?.checkboxState
        : parseCheckboxState(draft.draftData?.checkboxState as any);
    const payload: ShapeEntity = {
      ...(draft.draftData ?? {}),
      id: nodeId,
      checkboxState: parsedCheckbox,
      metadata: draft.draftMetadata ?? { name: '', description: '', tags: [] },
    } as ShapeEntity;
    await this.writeDraft(nodeId, payload, draft.draftMetadata ?? { name: '', description: '', tags: [] });
    return payload;
  }

  async updateProcessingStatus(
    nodeId: NodeId,
    status: 'idle' | 'processing' | 'completed' | 'failed',
    batchSessionId?: string,
  ): Promise<void> {
    const coreDB = await this.ensureCoreDB();
    const node = await this.readNode(nodeId);
    if (!node) {
      throw new Error(`TreeNode not found: ${nodeId}`);
    }
    const hasDraft = (node as { draftData?: unknown }).draftData !== null &&
      typeof (node as { draftData?: unknown }).draftData !== 'undefined';
    const targetField = hasDraft ? 'draftData' : 'data';
    const targetValue = (node as unknown as Record<string, unknown>)[targetField];
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
