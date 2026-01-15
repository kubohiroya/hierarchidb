/**
 * Tag Entity Types
 */

import type { RelationalEntity } from './entity-types.js';
import type { NodeId, TagId } from './id-types.js';
import type { Timestamp } from './primitive-types.js';

export interface TagEntity extends RelationalEntity<TagId> {
  name: string;
  color: string;
  description?: string;
  category: 'system' | 'user' | 'auto';
  usageCount: number;
}

export interface TagSuggestion {
  id: TagId;
  name: string;
  color: string;
  usageCount: number;
}

export type NodeTagAssociationId = string & { readonly __brand: 'NodeTagAssociationId' };

export interface NodeTagAssociation {
  id: NodeTagAssociationId;
  nodeId: NodeId;
  tagId: TagId;
  assignedAt: Timestamp;
  assignedBy?: string; //  ID
}
