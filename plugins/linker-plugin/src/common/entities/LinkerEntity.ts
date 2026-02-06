import type { NodeId, PeerEntity } from '@hierarchidb/core-types';
import type { TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';

export interface LinkerEntityPayload {
  name: string;
  description?: string;
  tags?: string[];
  linkedNodeIds: NodeId[];
}

export type LinkerEntity = PeerEntity<LinkerEntityPayload>;

export type LinkerDraft = TreeNodeUpdaterPayload<LinkerEntity>;
