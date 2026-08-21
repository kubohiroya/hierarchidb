import type { NodeId } from '@hierarchidb/core-types';
import type { ValidatedYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';

export type YamlCanonicalZipExportSlot = 'committed' | 'draft';

export interface ExportYamlCanonicalZipInput {
  readonly parentId: NodeId;
  readonly slot: YamlCanonicalZipExportSlot;
}

export interface ImportYamlCanonicalZipInput {
  readonly parentId: NodeId;
  readonly archiveBase64: string;
}

export type YamlCanonicalZipErrorCode =
  | 'ACCESS_DENIED'
  | 'INVALID_INPUT'
  | 'PARENT_NOT_FOUND'
  | 'PARENT_NOT_FOLDER'
  | 'EXPORT_PLAN_REJECTED'
  | 'IMPORT_PLAN_REJECTED'
  | 'IMPORT_TRANSACTION_REJECTED';

export type ExportYamlCanonicalZipResult =
  | Readonly<{
      readonly ok: true;
      readonly archiveBase64: string;
      readonly byteLength: number;
      readonly nodeIds: readonly NodeId[];
    }>
  | Readonly<{ readonly ok: false; readonly code: YamlCanonicalZipErrorCode }>;

export type ImportYamlCanonicalZipResult =
  | Readonly<{ readonly ok: true; readonly nodeIds: readonly NodeId[] }>
  | Readonly<{ readonly ok: false; readonly code: YamlCanonicalZipErrorCode }>;

export interface YamlCanonicalZipAPI {
  exportYamlCanonicalZip(input: ExportYamlCanonicalZipInput): Promise<ExportYamlCanonicalZipResult>;
  importYamlCanonicalZip(input: ImportYamlCanonicalZipInput): Promise<ImportYamlCanonicalZipResult>;
}

export interface YamlCanonicalZipFolderSnapshot {
  readonly parent: unknown;
  readonly children: readonly unknown[];
  readonly existingNodeIds: readonly string[];
}

export interface YamlCanonicalZipImportNode {
  readonly id: string;
  readonly parentId: string;
  readonly nodeType: 'yaml-file';
  readonly depth: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly version: 1;
  readonly metadata: Readonly<{
    readonly name: string;
    readonly description: '';
    readonly tags: readonly string[];
  }>;
  readonly draftMetadata: null;
  readonly data: ValidatedYamlCanonicalPayload;
  readonly visible: true;
}

export interface YamlCanonicalZipImportTransactionRequest {
  readonly parentGuard: Readonly<{
    readonly sourceIndex: number;
    readonly nodeId: string;
    readonly expectedVersion: number;
    readonly expectedDepth: number;
    readonly expectedHasChildren: boolean | undefined;
  }>;
  readonly siblingGuards: readonly Readonly<{
    readonly sourceIndex: number;
    readonly nodeId: string;
    readonly expectedVersion: number;
    readonly parentId: string;
    readonly metadataName: string;
  }>[];
  readonly existingNodeIdGuard: readonly string[];
  readonly nodes: readonly YamlCanonicalZipImportNode[];
  readonly parentPatch?: Readonly<{
    readonly id: string;
    readonly expectedVersion: number;
    readonly postimage: Readonly<{
      readonly hasChildren: true;
      readonly updatedAt: number;
      readonly version: number;
    }>;
  }>;
}

export interface YamlCanonicalZipCoreDbPort {
  readFolderSnapshot(parentId: NodeId): Promise<YamlCanonicalZipFolderSnapshot>;
  commitImport(request: YamlCanonicalZipImportTransactionRequest): Promise<readonly NodeId[]>;
}

export interface YamlCanonicalZipServiceEnvironment {
  readonly coreDB: YamlCanonicalZipCoreDbPort;
  readonly assertCanonicalAccess: () => void;
  readonly generateNodeId: () => NodeId;
  readonly now: () => number;
}

export type YamlCanonicalZipServiceFactory = (
  environment: YamlCanonicalZipServiceEnvironment
) => YamlCanonicalZipAPI;
