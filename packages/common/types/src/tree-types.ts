import { NodeId, TreeId } from './id-types';

export interface Tree {
  id: TreeId;
  name: string;
  rootId: NodeId;
  trashRootId: NodeId;
  superRootId: NodeId;
}
