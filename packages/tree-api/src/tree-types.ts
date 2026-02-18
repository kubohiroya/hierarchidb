import type { NodeId, TreeId } from '@hierarchidb/core-types';

export interface Tree {
  id: TreeId;
  name: string;
  rootId: NodeId;
  archiveRootId: NodeId;
  superRootId: NodeId;
}
