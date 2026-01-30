/**
 * Tag Entity Types
 */

import type { RelationalEntity } from '@hierarchidb/core-types';
import type { NodeId, TagId, Timestamp } from '@hierarchidb/core-types';

export interface TagEntity extends RelationalEntity<TagId> {
  name: string;
  color: string;
  description?: string;
  category: 'system' | 'user' | 'auto';
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
