/**
 * Shared types for Folder plugin - UI-Worker
 */

// Re-export existing types from the entities directory
export type {
  FolderEntity,
  FolderOperationResult,
  FolderSearchQuery,
} from './FolderEntity.ts';

/**
 * Create/Update data types for API operations
 */
export interface CreateFolderData {
  name: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateFolderData {
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface FolderPeerData {
  schemaVersion: 1;
  domain: Record<string, unknown>;
}

export const normalizeFolderPeerData = (data?: FolderPeerData | null): FolderPeerData => ({
  schemaVersion: 1,
  domain: data?.domain ?? {},
});
