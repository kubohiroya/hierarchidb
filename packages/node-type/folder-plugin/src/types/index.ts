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
  FolderSettings,
} from '../entities/FolderEntity';

// Import tag-related types
import type { EntityId } from '@hierarchidb/common-type';
export type TagId = EntityId;
export type { TagSuggestion } from '@hierarchidb/common-type';

// Keep existing simple types for backward compatibility if needed
import type { FolderSettings as ImportedFolderSettings } from '../entities/FolderEntity';

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
  settings: ImportedFolderSettings;
  [key: string]: any; // Allow additional properties for extensibility
}
