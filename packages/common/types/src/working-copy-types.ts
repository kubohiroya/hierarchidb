import { NodeId } from './id-types';
import { TreeNode } from './tree-node-types';

/**
 * Properties for working copies (temporary copies of nodes being edited)
 * A working copy node is a special purpose
 *
 * According to the specification:
 * - Working copy is a TreeNode stored as a descendant of the workingCopy root
 */

/**
 * Complete working copy stored in EphemeralDB
 * Working copy is essentially a TreeNode with additional working copy properties
 */
export type WorkingCopyProperties = {
  /**
   * name: the "name" field will be used for the placeholder for the id of the riginal node id
     aka. workingCopyOf: NodeId;
   */
  /**
   * version : The "version" of this node is a copy of the original version for conflict detection
   */
  workingCopyOf: NodeId;
};

// Working Copy関連の型定義
export interface CommitResult {
  success: boolean;
  node?: TreeNode;
  error?: string;
}
