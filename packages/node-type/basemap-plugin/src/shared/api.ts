/**
 * @file shared/api.ts
 * @description BaseMap API interfaces
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../entities/BaseMapEntity';
import type { BaseMapConfig } from './types';

export interface BaseMapAPI {
  // Entity operations
  createBaseMapEntity(nodeId: NodeId, config: BaseMapConfig): Promise<BaseMapEntity>;

  getBaseMapEntity(entityId: NodeId): Promise<BaseMapEntity | null>;

  updateBaseMapEntity(entityId: NodeId, updates: Partial<BaseMapEntity>): Promise<BaseMapEntity>;

  deleteBaseMapEntity(entityId: NodeId): Promise<void>;

  // Working copy operations
  createWorkingCopy(entity: BaseMapEntity): Promise<BaseMapWorkingCopy>;

  getWorkingCopy(workingCopyId: NodeId): Promise<BaseMapWorkingCopy | undefined>;

  updateWorkingCopy(workingCopyId: NodeId, updates: Partial<BaseMapEntity>): Promise<BaseMapWorkingCopy>;

  commitWorkingCopy(workingCopyId: NodeId): Promise<NodeId>;

  discardWorkingCopy(workingCopyId: NodeId): Promise<void>;

  // Configuration validation
  validateConfiguration(config: BaseMapConfig): Promise<{ isValid: boolean; errors: string[] }>;

  // Style management
  getAvailableStyles(): Promise<Array<{ id: string; name: string; url: string }>>;

  validateStyleUrl(styleUrl: string): Promise<boolean>;
}
