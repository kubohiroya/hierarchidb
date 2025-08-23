import type { Timestamp } from "./base";
import type { NodeId, EntityId } from "./ids";
import type { TreeNode } from "./tree";

/**
 * Properties for working copies (temporary copies of nodes being edited)
 *
 * According to the specification:
 * - Working copy is a TreeNode stored in EphemeralDB
 * - For editing: uses the same id as the original
 * - For new creation: uses a newly output id
 */
export interface WorkingCopyProperties {
  /**
   * ID of the original node (for editing mode)
   * For new creation, this is undefined
   */
  originalNodeId?: NodeId;

  /**
   * Timestamp when the working copy was created
   */
  copiedAt: Timestamp;

  /**
   * Indicates if entity has been copied (copy-on-write)
   */
  hasEntityCopy?: boolean;

  /**
   * ID of the copied entity (if copy-on-write has occurred)
   */
  entityWorkingCopyId?: EntityId;

  /**
   * Original version for conflict detection
   */
  originalVersion?: number;

  /**
   * Tracks which sub-entity types have been copied (copy-on-write)
   */
  hasGroupEntityCopy?: Record<string, boolean>;
}

/**
 * Complete working copy stored in EphemeralDB
 * Working copy is essentially a TreeNode with additional working copy properties
 */
export type WorkingCopy = TreeNode & WorkingCopyProperties;
