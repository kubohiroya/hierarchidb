/**
  * Tag Entity Types
   */

import type { NodeId, TagId } from './id-types.js';
import type { RelationalEntity } from './entity-types.js';
import { Timestamp } from './primitive-types.js';

/**
  * TagEntity -
 * RelationalEntity
  */
export interface TagEntity extends RelationalEntity<TagId> {
  /**
      */
  name: string;

  /**
   * 16
   */
  color: string;

  /**
      */
  description?: string;

  /**
      */
  category: 'system' | 'user' | 'auto';

  /**
      */
  usageCount: number;
}

/**
  * TagSuggestion -
  */
export interface TagSuggestion {
  id: TagId;
  name: string;
  color: string;
  usageCount: number;
  description?: string;
}

/**
  * NodeTagAssociation -
 * Many-to-Many
  */
export type NodeTagAssociationId = string & { readonly __brand: 'NodeTagAssociationId' };

export interface NodeTagAssociation {
  id: NodeTagAssociationId;
  nodeId: NodeId;
  tagId: TagId;
  assignedAt: Timestamp;
  assignedBy?: string; //  ID
}

/**
  * TagUsageStatistics -
  */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TagUsageStatistics {
  tagId: TagId;
  totalUsage: number;
  recentUsage: number; //  30
  nodeTypes: Record<string, number>;
  lastUsedAt: Timestamp;
}

/**
  * TagSearchOptions -
  */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TagSearchOptions {
  query?: string;
  category?: 'system' | 'user' | 'auto';
  limit?: number;
  sortBy?: 'name' | 'usageCount' | 'recentUsage';
  sortOrder?: 'asc' | 'desc';
}
