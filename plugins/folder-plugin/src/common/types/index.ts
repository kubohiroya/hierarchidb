// Import tag-related types
export type { TagId } from '@hierarchidb/common-types';

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
}

// Export entity definition
export * from './FolderEntity.js';
export * from './types.js';