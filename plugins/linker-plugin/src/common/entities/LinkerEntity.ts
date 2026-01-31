import type { BaseEntity, NodeId, Timestamp } from '@hierarchidb/core-types';
import type { TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';

export interface LinkerEntity extends BaseEntity<NodeId> {
  id: NodeId;
  name: string;
  description?: string;
  tags?: string[];
  linkedNodeIds: NodeId[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type LinkerDraft = TreeNodeUpdaterPayload<Partial<LinkerEntity>>;
