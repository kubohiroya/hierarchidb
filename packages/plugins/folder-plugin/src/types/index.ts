// Re-export the comprehensive folder-plugin entity definitions from entities
export type {
  FolderEntity,
  FolderOperationResult,
  FolderSearchQuery,
  FolderStatsSummary,
  FolderStructureNode,
} from '../entities/FolderEntity.js';

// Import tag-related types
export type { TagId } from '@hierarchidb/common-types';
// Keep existing simple types for backward compatibility if needed
import type { FolderSettings as ImportedFolderSettings } from '../shared/types.js';

export type { TagSuggestion } from '@hierarchidb/common-types';

// Additional display types for UI
import type { NodeId } from '@hierarchidb/common-types';

export interface FolderDisplayData {
  id: NodeId;
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
  settings: ImportedFolderSettings;

  [key: string]: unknown; // Allow additional properties for extensibility
}
