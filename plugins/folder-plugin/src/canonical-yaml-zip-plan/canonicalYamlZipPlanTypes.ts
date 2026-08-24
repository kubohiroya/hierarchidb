import type { ValidatedYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import type { CanonicalYamlZipCodecErrorCode, EncodedCanonicalYamlZip } from '../canonical-yaml-zip-codec/canonicalYamlZipCodecTypes.js';

export type CanonicalYamlZipExportSlot = 'committed' | 'draft';

export interface CanonicalYamlZipNodeGuard {
  readonly sourceIndex: number;
  readonly nodeId: string;
  readonly expectedVersion: number;
}

export interface CanonicalYamlZipSiblingGuard extends CanonicalYamlZipNodeGuard {
  readonly parentId: string;
  readonly metadataName: string;
}

export interface CanonicalYamlZipParentGuard extends CanonicalYamlZipNodeGuard {
  readonly expectedDepth: number;
  readonly expectedHasChildren: boolean | undefined;
}

export interface CanonicalYamlZipExportPlan {
  readonly slot: CanonicalYamlZipExportSlot;
  readonly nodeGuards: readonly CanonicalYamlZipNodeGuard[];
  readonly archive: EncodedCanonicalYamlZip;
}

export interface CanonicalYamlZipImportedNode {
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

export interface CanonicalYamlZipParentPatch {
  readonly id: string;
  readonly expectedVersion: number;
  readonly postimage: Readonly<{
    readonly hasChildren: true;
    readonly updatedAt: number;
    readonly version: number;
  }>;
}

export interface CanonicalYamlZipImportTransactionRequest {
  readonly parentGuard: CanonicalYamlZipParentGuard;
  readonly siblingGuards: readonly CanonicalYamlZipSiblingGuard[];
  readonly existingNodeIdGuard: readonly string[];
  readonly nodes: readonly CanonicalYamlZipImportedNode[];
  readonly parentPatch?: CanonicalYamlZipParentPatch;
}

export interface CanonicalYamlZipImportPlan {
  readonly parentGuard: CanonicalYamlZipParentGuard;
  readonly siblingGuards: readonly CanonicalYamlZipSiblingGuard[];
  readonly existingNodeIdGuard: readonly string[];
  readonly request: CanonicalYamlZipImportTransactionRequest;
}

export type CanonicalYamlZipPlanInputField =
  | 'input'
  | 'slot'
  | 'nodes'
  | 'archive'
  | 'parent'
  | 'siblings'
  | 'existingNodeIds'
  | 'generatedNodeIds'
  | 'timestamp'
  | 'node'
  | 'metadata'
  | 'draftMetadata'
  | 'data'
  | 'draftData'
  | 'id'
  | 'parentId'
  | 'nodeType'
  | 'depth'
  | 'version'
  | 'hasChildren'
  | 'transactionPort'
  | 'plan';

export type CanonicalYamlZipPlanInputReason =
  | 'missing'
  | 'undefined'
  | 'null'
  | 'invalid-type'
  | 'empty'
  | 'invalid-value'
  | 'invalid-item'
  | 'unexpected-field'
  | 'accessor-property'
  | 'reflection-failure'
  | 'length-mismatch'
  | 'duplicate';

export type CanonicalYamlZipPlanError =
  | Readonly<{
      readonly code: 'INVALID_INPUT';
      readonly context: Readonly<{
        readonly field: CanonicalYamlZipPlanInputField;
        readonly reason: CanonicalYamlZipPlanInputReason;
        readonly sourceIndex?: number;
      }>;
    }>
  | Readonly<{
      readonly code: 'CANONICAL_VALIDATION_FAILED';
      readonly sourceIndex: number;
      readonly slot: CanonicalYamlZipExportSlot;
    }>
  | Readonly<{
      readonly code: 'ZIP_CODEC_FAILED';
      readonly codecCode: CanonicalYamlZipCodecErrorCode;
      readonly entryIndex?: number;
    }>
  | Readonly<{
      readonly code: 'NODE_ID_COLLISION';
      readonly entryIndex: number;
    }>
  | Readonly<{
      readonly code: 'SIBLING_NAME_CONFLICT';
      readonly entryIndex: number;
    }>
  | Readonly<{ readonly code: 'INVALID_PLAN' }>
  | Readonly<{ readonly code: 'TRANSACTION_PORT_FAILED' }>;

export type PlanCanonicalYamlZipExportResult =
  | Readonly<{ readonly ok: true; readonly plan: CanonicalYamlZipExportPlan }>
  | Readonly<{ readonly ok: false; readonly errors: readonly CanonicalYamlZipPlanError[] }>;

export type PlanCanonicalYamlZipImportResult =
  | Readonly<{ readonly ok: true; readonly plan: CanonicalYamlZipImportPlan }>
  | Readonly<{ readonly ok: false; readonly errors: readonly CanonicalYamlZipPlanError[] }>;

export type CanonicalYamlZipImportTransactionPort = (
  request: CanonicalYamlZipImportTransactionRequest
) => Promise<void>;

export type CommitCanonicalYamlZipImportPlanResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipPlanError }>;
