import type { NodeId } from '@hierarchidb/core-types';

export const IDEGSM_PROJECT_NODE_TYPE = 'idegsm-project' as const;
export const IDEGSM_PROJECT_ENTITY_VERSION = 1 as const;

export type IdeGsmProjectSyncState = 'not-synced' | 'syncing' | 'synced' | 'stale' | 'failed';

export interface IdeGsmProjectRootNodeData {
  readonly version: typeof IDEGSM_PROJECT_ENTITY_VERSION;
  readonly connectionName: string;
  readonly projectRelativePath: string;
  readonly activeSyncGenerationId: string | null;
  readonly syncState: IdeGsmProjectSyncState;
  readonly syncedAt: string | null;
}

export type IdeGsmProjectChildKind = 'folder' | 'yaml-file' | 'csv-file';

export interface IdeGsmProjectChildMetadata {
  readonly projectNodeId: NodeId;
  readonly generationId: string;
  readonly relativePath: string;
  readonly kind: IdeGsmProjectChildKind;
  readonly digest: string | null;
  readonly sizeBytes: number | null;
  readonly updatedAt: string | null;
}

export interface IdeGsmProjectIdentity {
  readonly connectionName: string;
  readonly projectRelativePath: string;
}

export interface IdeGsmProjectDirectoryRequest extends IdeGsmProjectIdentity {
  readonly path?: string;
  readonly depth?: number;
}

export interface IdeGsmProjectCreateDraft {
  readonly connectionName?: string;
  readonly projectRelativePath?: string;
}

export class IdeGsmProjectContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdeGsmProjectContractError';
  }
}
