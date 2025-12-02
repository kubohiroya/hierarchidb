import type {
  BaseEntity,
  NodeId,
  Timestamp,
  TreeNodeUpdaterPayload,
} from '@hierarchidb/common-types';

export interface LinkerEntity extends BaseEntity<NodeId> {
  id: NodeId;
  nodeId: NodeId;
  name: string;
  description?: string;
  tags?: string[];
  linkedNodeIds: NodeId[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type LinkerDraft = TreeNodeUpdaterPayload<Partial<LinkerEntity>>;
