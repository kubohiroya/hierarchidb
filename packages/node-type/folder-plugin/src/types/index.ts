// Re-export the comprehensive folder-plugin entity definitions from entities
export type {
  FolderEntity,
  FolderBookmark,
  FolderTemplate,
  FolderWorkingCopy,
  FolderOperationResult,
  FolderSearchQuery,
  FolderStatsSummary,
  FolderStructureNode,
} from '../entities/FolderEntity';

// Keep existing simple types for backward compatibility if needed
import type { NodeId, EntityId } from '@hierarchidb/common-type';

export interface FolderEntityWorkingCopy {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  description?: string; // Make optional to match comprehensive version
  settings: FolderSettings;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  version: number;
  copiedAt: number;
  originalNodeId?: NodeId;
  hasEntityCopy?: boolean;
  entityWorkingCopyId?: EntityId;
  originalVersion?: number;
  hasGroupEntityCopy?: Record<string, boolean>;
}

export interface FolderSettings {
  allowNestedFolders?: boolean;
  maxDepth?: number;
  sortOrder?: 'name' | 'date' | 'type' | 'size';
}

// Additional display types for UI
export interface FolderDisplayData {
  id: EntityId;
  name: string;
  description?: string;
  hasChildren: boolean;
  childCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface FolderEditData {
  name: string;
  description?: string;
  settings: FolderSettings;
  [key: string]: any; // Allow additional properties for extensibility
}
