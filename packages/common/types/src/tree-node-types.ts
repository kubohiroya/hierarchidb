import type { NodeId, NodeType } from './id-types.js';
import type { Timestamp } from './primitive-types.js';

/**
 * Regular node type constants for common node types
 */
export const NODE_TYPES = {
  FOLDER: 'folder',
  FILE: 'file',
  // Plugin-specific types will be added dynamically
} as const;

export interface TreeNodeMetadata {
  name: string;
  description?: string;
  tags?: string[];
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

export interface DialogWindowState {
  mode?: 'normal' | 'maximize' | 'full-screen';
  position?: { x: number; y: number } | null;
  size?: { width: number; height: number } | null;
}

export interface DialogProgressState {
  /** Zero-based index of the last active step when the dialog was persisted. */
  activeStepIndex: number;
}

export interface DialogUIState {
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
  // Add minimal UI-only flags here to avoid mixing with domain data.
}

// Base shape for payloads; keep structural typing while avoiding primitive-only payloads.
export type NodePayloadBase = Record<string, unknown>;
export type NodePayload = NodePayloadBase | null;

/**
 * Dexie nodes table record (single source of truth).
 * - Domain data lives in `data` (committed) and `draftData` (working copy).
 * - UI state is scoped to `dialogUIState` and should be cleared on commit/discard.
 * - Structural metadata stays at the top level and must not be duplicated under data.
 */
export type PersistedTreeNode<
  TData extends NodePayloadBase | null = NodePayloadBase | null
> = NodeBase & {
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
  data: TData;
  /**
   * Working copy data; null when no draft exists
   */
  draftData: TData | null;
  dialogUIState?: DialogUIState;
  hasChildren?: boolean;
  descendantCount?: number;
  isEstimated?: boolean;
  references?: NodeId[];
  originalName?: string;
  originalParentId?: NodeId;
  removedAt?: Timestamp;
  lastTouchedAt?: Timestamp;
};

export type TreeNode<TPayload extends NodePayloadBase | null = NodePayload> =
  PersistedTreeNode<TPayload>;

export interface TreeNodeWithChildren<TPayload extends NodePayload = NodePayload>
  extends PersistedTreeNode<TPayload>,
    DescendantProperties {
  children?: NodeId[];
}

/**
 * Working copy payload (drafted metadata/data) used across UI/Worker dialog flows.
 */
export interface TreeNodeUpdaterPayload<T extends object = object> {
  id: NodeId;
  draftMetadata: TreeNodeMetadata | null;
  draftData: Partial<T> | null;
}

/**
 * Working copy container exposed over dialog APIs.
 */
export interface TreeNodeUpdater<T extends object = object> {
  payload: TreeNodeUpdaterPayload<T>;
  parentNodeId: NodeId;
  dialogUIState?: DialogUIState;
  version: number;
}
