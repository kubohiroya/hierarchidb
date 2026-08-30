import type { NodeId } from '@hierarchidb/core-types';

export const IDEGSM_PROJECT_NODE_TYPE = 'idegsm-project' as const;
export const IDEGSM_PROJECT_ENTITY_VERSION = 1 as const;

export type IdeGsmProjectSyncState = 'not-synced' | 'syncing' | 'synced' | 'stale' | 'failed';

export interface IdeGsmProjectRootNodeData extends Record<string, unknown> {
  readonly version: typeof IDEGSM_PROJECT_ENTITY_VERSION;
  readonly connectionName: string;
  readonly projectRelativePath: string;
  readonly activeSyncGenerationId: string | null;
  readonly syncState: IdeGsmProjectSyncState;
  readonly syncedAt: string | null;
}

export type IdeGsmProjectChildKind = 'folder' | 'yaml-file' | 'csv-file';

export interface IdeGsmProjectChildMetadata extends Record<string, unknown> {
  readonly projectNodeId: NodeId;
  readonly generationId: string;
  readonly relativePath: string;
  readonly kind: IdeGsmProjectChildKind;
  readonly digest: string | null;
  readonly sizeBytes: number | null;
  readonly updatedAt: string | null;
}

export interface IdeGsmProjectIdentity extends Record<string, unknown> {
  readonly connectionName: string;
  readonly projectRelativePath: string;
}

export interface IdeGsmProjectDirectoryRequest extends IdeGsmProjectIdentity {
  readonly path?: string;
  readonly depth?: number;
}

export interface IdeGsmProjectCreateDraft extends Record<string, unknown> {
  readonly connectionName?: string;
  readonly projectRelativePath?: string;
}

export interface IdeGsmProjectSnapshotEntry extends Record<string, unknown> {
  readonly relativePath: string;
  readonly kind: IdeGsmProjectChildKind;
  readonly digest?: string | null;
  readonly sizeBytes?: number | null;
  readonly updatedAt?: string | null;
  readonly yamlContent?: string;
}

export interface IdeGsmProjectSnapshotManifest extends Record<string, unknown> {
  readonly connectionName: string;
  readonly projectRelativePath: string;
  readonly entryCount: number;
  readonly yamlCount: number;
  readonly csvCount: number;
  readonly folderCount: number;
}

export interface IdeGsmProjectSnapshot extends Record<string, unknown> {
  readonly connectionName: string;
  readonly projectRelativePath: string;
  readonly entries: readonly IdeGsmProjectSnapshotEntry[];
}

export class IdeGsmProjectContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdeGsmProjectContractError';
  }
}
