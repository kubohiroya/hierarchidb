import type { NodeId, TreeId } from './id-types.js';

export interface Tree {
  id: TreeId;
  name: string;
  rootId: NodeId;
  trashRootId: NodeId;
  superRootId: NodeId;
}
