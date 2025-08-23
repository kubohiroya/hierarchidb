import type { NodeId, EntityId } from '@hierarchidb/00-core';

export interface FolderEntity {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  description: string;
  settings: FolderSettings;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface FolderEntityWorkingCopy {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  description: string;
  settings: FolderSettings;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  version: number;
  copiedAt: number;
  originalNodeId?: NodeId;
  hasEntityCopy?: boolean;
  entityWorkingCopyId?: EntityId;
  originalVersion?: number;
  hasGroupEntityCopy?: Record<string, boolean>;
}

export interface FolderSettings {
  allowNestedFolders: boolean;
  maxDepth: number;
  sortOrder: 'name' | 'date' | 'type' | 'size';
}

export interface FolderBookmark {
  id: EntityId;
  folderId: EntityId;
  name: string;
  url: string;
  description?: string;
  createdAt: number;
}

export interface FolderTemplate {
  id: EntityId;
  folderId: EntityId;
  name: string;
  content: any;
  description?: string;
  createdAt: number;
}