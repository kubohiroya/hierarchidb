import type { NodeId } from './id-types.js';
import type { Timestamp } from './primitive-types.js';
/**
 * Entity type classification
 */
export type EntityType = 'peer' | 'group' | 'relational';

/**
 */
export interface BaseEntity<ID = NodeId> {
  id: ID;
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
export type PeerEntity<
  TData extends object = Record<string, unknown>,
  ID = NodeId,
> = BaseEntity<ID> &
  TData & {
    nodeId: NodeId;
    dialogMode?: 'normal' | 'full';
    resumeStep?: number;
    mapParams?: {
      zoom: number;
      lng: number;
      lat: number;
    };
    disabled?: boolean;
  };

export type SavedPeerEntity<
  TData extends object = Record<string, unknown>,
  ID = NodeId,
> = PeerEntity<TData, ID>;

export type DraftPeerEntity<
  TData extends object = Record<string, unknown>,
  ID = NodeId,
> = PeerEntity<Partial<TData>, ID>;

/**
 * GroupEntity - TreeNode1N
 * 1TreeNodeGroupEntity
 * @example FeatureSubEntityGeoJSON
 */
export interface GroupEntity<ID = NodeId> extends BaseEntity<ID> {
  /** Associated tree node (required for GroupEntity). */
  nodeId: NodeId;
  type: string;
}

/**
 * RelationalEntity - TreeNodeNN
 * @example TableMetadataEntityStyler
 */
export interface RelationalEntity<ID = NodeId> extends BaseEntity<ID> {
  nodeIds: NodeId[];
  referenceCount: number;
  lastAccessedAt: Timestamp;
}
