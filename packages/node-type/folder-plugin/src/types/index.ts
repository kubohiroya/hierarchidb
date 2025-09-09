// Re-export the comprehensive folder-plugin entity definitions from entities
export type {
  FolderEntity,
  FolderWorkingCopy,
  FolderOperationResult,
  FolderSearchQuery,
  FolderStatsSummary,
  FolderStructureNode,
  FolderSettings,
} from '../entities/FolderEntity';

// Import tag-related types
export type { TagId } from '@hierarchidb/common-type';
// Keep existing simple types for backward compatibility if needed
import type { FolderSettings as ImportedFolderSettings } from '../entities/FolderEntity';

export type { TagSuggestion } from '@hierarchidb/common-type';

// Additional display types for UI
import type { NodeId } from '@hierarchidb/common-type';

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

  [key: string]: any; // Allow additional properties for extensibility
}
