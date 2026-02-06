/**
 * Tag Entity Types
 */

import type { RelationalEntity } from '@hierarchidb/core-types';
import type { NodeId, Timestamp } from '@hierarchidb/core-types';

export type TagId = string & { readonly __brand: 'TagId' };

export interface TagEntity extends RelationalEntity<TagId> {
  id: TagId;
  name: string;
  color: string;
  description?: string;
  createdAt: Timestamp;
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

export function toTagId(uuid: string): TagId {
  return uuid as TagId;
}
