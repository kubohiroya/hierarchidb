import type { NodeId } from '@hierarchidb/common-types';

// Minimal placeholder for PeerEntity. Real shape is domain-specific and will be
// introduced in subsequent PRs. We intentionally avoid UI-facing fields
// (e.g., name/description) to keep responsibilities separate from TreeNode.
export interface PeerEntity {
  nodeId: NodeId;
  // Arbitrary domain data placeholder
  data?: unknown;
  updatedAt?: number;
}
