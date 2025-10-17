import type { NodeId } from '@hierarchidb/common-types';

/**
 * Additional folder-plugin-specific properties for display
 */
export interface FolderDisplayData {
  id: NodeId;
  name: string;
  description?: string;
  hasChildren: boolean;
  childCount: number;
  createdAt: number;
  updatedAt: number;
}
