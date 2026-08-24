import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { DialogUIState } from './dialogStateTypes.js';
import type { ViewProperties } from './view-properties-types.js';

/**
 * Regular node type constants for _obsolate_common node types
 */
export const NODE_TYPES = {
  FOLDER: 'folder',
  // Plugin-specific types will be added dynamically
} as const;

export interface TreeNodeMetadata {
  name: string;
  description: string;
  tags: string[];
  buildMetadata?: NodeBuildMetadata;
}

export interface NodeBuildMetadata {
  buildState?: 'ready' | 'pending' | 'building' | 'failed';
  buildRequired?: boolean;
  buildProfile?: string;
  buildMode?: string;
  buildEstimate?: Record<string, unknown>;
  buildActual?: Record<string, unknown>;
  buildStartedAt?: Timestamp;
  buildFinishedAt?: Timestamp;
  buildError?: {
    code: string;
    message: string;
    source?: string;
    detail?: unknown;
  };
}

export interface NodeBase {
  id: NodeId;
  parentId: NodeId;
  nodeType: NodeType;
  depth: number; // Mandatory depth property for efficient subscription filtering
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

export interface DescendantProperties {
  hasChildren?: boolean;
  descendantCount?: number;
  isEstimated?: boolean;
}

export interface ReferenceProperties {
  references?: NodeId[];
}

// Base shape for payloads; keep structural typing while avoiding primitive-only payloads.
export type NodePayload = Record<string, unknown>;
// Alias for readability
export type TreeNodeData = NodePayload;

/**
 * Dexie nodes table record (single source of truth).
 * - Domain data lives in `data` (committed) and `draftData` (draft atoms).
 * - UI atoms is scoped to `dialogUIState` and should be cleared on commit/discard.
 * - Structural metadata stays at the top level and must not be duplicated under data.
 */
export type TreeNode<TData extends NodePayload | null = NodePayload | null> = NodeBase & {
  /**
   * Committed metadata (name/description/tags) — authoritative
   */
  metadata: TreeNodeMetadata;
  /**
   * Working copy metadata; null when no draft exists
   */
  draftMetadata: TreeNodeMetadata | null;
  /**
   * Committed domain data (plugin-specific payload)
   */
  data: TData | null;
  /**
   * Working copy data; undefined when no draft exists
   */
  draftData?: TData;
  /**
   * Optional source node for copy-on-write effective data resolution.
   */
  copyOnWriteOf?: NodeId;
  /**
   * Data patch merged onto the copy-on-write source data.
   */
  patchData?: NodePayload;
  /**
   * Temporary flag for pre-commit nodes created from UI flows.
   */
  isTemporary?: boolean;
  /**
   * Optional visibility toggle (default: true when undefined).
   */
  visible: boolean;
  dialogUIState?: DialogUIState;
  hasChildren?: boolean;
  descendantCount?: number;
  isEstimated?: boolean;
  references?: NodeId[];
  originalName?: string;
  originalParentId?: NodeId;
  removedAt?: Timestamp;
  lastTouchedAt?: Timestamp;
  map?: {
    zxy: string;
  };
  /**
   * Optional view-related settings (viewMode, sortMode, zoomLevel, iconPosition).
   * Persisted per-node; absent means the UI layer applies defaults.
   */
  viewProperties?: ViewProperties;
};

export interface TreeNodeWithChildren<TData extends NodePayload | null = NodePayload | null>
  extends TreeNode<TData>,
    DescendantProperties {
  children?: NodeId[];
}

/**
 * Working copy payload (drafted metadata/data) used across UI/Worker dialog flows.
 */
export interface TreeNodeUpdaterPayload<T> {
  treeNodeId: NodeId;
  draftMetadata: TreeNodeMetadata | null;
  draftData?: Partial<T>;
  buildStartedAt?: Timestamp;
  buildFinishedAt?: Timestamp;
}

/**
 * Working copy container exposed over dialog APIs.
 */
export interface TreeNodeUpdater<T> {
  payload: TreeNodeUpdaterPayload<T>;
  parentNodeId: NodeId;
  dialogUIState?: DialogUIState;
  version: number;
}
