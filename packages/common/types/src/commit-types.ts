import type { TreeNode } from './tree-node-types.js';

export interface CommitResult {
  success: boolean;
  node?: TreeNode;
  error?: string;
}

