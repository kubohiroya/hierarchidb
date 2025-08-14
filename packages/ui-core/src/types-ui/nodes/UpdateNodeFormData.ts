import { TreeNodeId, TreeNodeType } from './';

export interface UpdateNodeFormData {
  id?: TreeNodeId;
  type?: TreeNodeType;
  isDraft?: boolean;
  name?: string;
  description?: string;
}
