/**
 * Tag Entity Types
 */

import type { NodeId, RelationalEntity, Timestamp } from '@hierarchidb/core-types';

export type TagId = string & { readonly __brand: 'TagId' };

export interface TagEntity extends RelationalEntity<TagId> {
  id: TagId;
  name: string;
  color: string;
  description?: string;
  createdAt: Timestamp;
}

export type NodeTagAssociationId = string & { readonly __brand: 'NodeTagAssociationId' };

export type TagAssociationScope = 'draft' | 'published';

export interface NodeTagAssociation {
  id: NodeTagAssociationId;
  nodeId: NodeId;
  tagId: TagId;
  scope: TagAssociationScope;
  assignedAt: Timestamp;
  assignedBy?: string; //  ID
}

export function toTagId(uuid: string): TagId {
  return uuid as TagId;
}
