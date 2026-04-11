import type { NodeId } from './id-types.js';
import type { Timestamp } from './primitiveTypes.js';

/**
 */
export interface BaseEntity {
  id: NodeId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
 * PeerEntity - TreeNode11
 * TreeNode
 * TreeNode1PeerEntity
 * @example StylerEntity, BaseMapEntity
 */
export type PeerEntity<TData> = BaseEntity & TData;

/**
 * GroupEntity - TreeNode1N
 * 1TreeNodeGroupEntity
 * @example FeatureSubEntityGeoJSON
 */
export interface GroupEntity extends BaseEntity {
  /** Associated tree node (required for GroupEntity). */
  nodeId: NodeId;
  type: string;
}

/**
 * RelationalEntity - TreeNodeNN
 * @example TableMetadataEntityStyler
 */
export interface RelationalEntity<ID> {
  id: ID;
  referenceCount: number;
  lastAccessedAt: Timestamp;
}
