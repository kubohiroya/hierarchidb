/**
 * @file shared/api.ts
 * @description BaseMap API interfaces
 */

import type { NodeId } from '@hierarchidb/common-types';
import type { BaseMapEntity, BaseMapDraft } from './BaseMapEntity.js';
import type { BaseMapConfig } from './types.js';

export interface BaseMapAPI {
  // Entity operations
  createBaseMapEntity(nodeId: NodeId, config: BaseMapConfig): Promise<BaseMapEntity>;

  getBaseMapEntity(entityId: NodeId): Promise<BaseMapEntity | null>;

  updateBaseMapEntity(entityId: NodeId, updates: Partial<BaseMapEntity>): Promise<BaseMapEntity>;

  deleteBaseMapEntity(entityId: NodeId): Promise<void>;

  // Working copy operations
  createDraft(entity: BaseMapEntity): Promise<BaseMapDraft>;

  getDraft(draftId: NodeId): Promise<BaseMapDraft | undefined>;

  updateDraft(
    draftId: NodeId,
    updates: Partial<BaseMapEntity>
  ): Promise<BaseMapDraft>;

  commitDraft(draftId: NodeId): Promise<NodeId>;

  discardDraft(draftId: NodeId): Promise<void>;

  // Configuration validation
  validateConfiguration(config: BaseMapConfig): Promise<{ isValid: boolean; errors: string[] }>;

  // Style management
  getAvailableStyles(): Promise<Array<{ id: string; name: string; url: string }>>;

  validateStyleUrl(styleUrl: string): Promise<boolean>;
}
