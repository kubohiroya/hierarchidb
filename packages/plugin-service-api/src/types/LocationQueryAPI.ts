import type { NodeId } from '@hierarchidb/common-types';
import type { LocationGroupItemData, LocationRelationMeta } from './locationTypes.js';

export interface LocationGroupItem {
  id: string;
  data?: LocationGroupItemData;
  updatedAt?: number;
}

export interface LocationRelation {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: LocationRelationMeta;
  updatedAt?: number;
}

/**
 * Exposes location plugin artifacts.
 * Data is persisted independently and is not yet tied to TreeNode lifecycle events.
 */
export interface LocationQueryAPI {
  listLocationGroups(nodeId: NodeId): Promise<LocationGroupItem[]>;
  listLocationRelations(nodeId: NodeId): Promise<LocationRelation[]>;
}
