// Branded type for node IDs - matches @hierarchidb/core types
export type NodeId = string & { readonly __brand: 'NodeId' };

/**
 * Data required to create a new folder
 */
export interface FolderCreateData {
  name: string;
  description?: string;
}

/**
 * Data for editing a folder
 */
export interface FolderEditData {
  name?: string;
  description?: string;
}

/**
 * Additional folder-specific properties for display
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
