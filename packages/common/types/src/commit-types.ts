import type { TreeNode } from './tree-node-types';

export interface CommitResult {
  success: boolean;
  node?: TreeNode;
  error?: string;
}

