/**
 * @file shared/api.ts
 * @description BaseMap API interfaces
 */

import type { NodeId, EntityId } from '@hierarchidb/common-type';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../entities/BaseMapEntity';
import type { BaseMapConfig } from './types';

export interface BaseMapAPI {
  // Entity operations
  createBaseMapEntity(nodeId: NodeId, config: BaseMapConfig): Promise<BaseMapEntity>;
  getBaseMapEntity(entityId: EntityId): Promise<BaseMapEntity | null>;
  updateBaseMapEntity(entityId: EntityId, updates: Partial<BaseMapEntity>): Promise<BaseMapEntity>;
  deleteBaseMapEntity(entityId: EntityId): Promise<void>;

  // Working copy operations
  createWorkingCopy(entity: BaseMapEntity): Promise<BaseMapWorkingCopy>;
  getWorkingCopy(workingCopyId: EntityId): Promise<BaseMapWorkingCopy | undefined>;
  updateWorkingCopy(workingCopyId: EntityId, updates: Partial<BaseMapEntity>): Promise<BaseMapWorkingCopy>;
  commitWorkingCopy(workingCopyId: EntityId): Promise<NodeId>;
  discardWorkingCopy(workingCopyId: EntityId): Promise<void>;

  // Configuration validation
  validateConfiguration(config: BaseMapConfig): Promise<{ isValid: boolean; errors: string[] }>;
  
  // Style management
  getAvailableStyles(): Promise<Array<{ id: string; name: string; url: string }>>;
  validateStyleUrl(styleUrl: string): Promise<boolean>;
}