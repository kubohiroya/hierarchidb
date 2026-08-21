import type { NodeId } from '@hierarchidb/core-types';
import type {
  ValidatedYamlCanonicalPayload,
  YamlCanonicalValidationError,
} from '@hierarchidb/yaml-api/validation';

/** Save modes accepted by the canonical dialog writer. */
export type YamlCanonicalDialogWriteMode = 'save-draft' | 'save';

/** Valid caller input after the runtime contract has been checked. */
export interface YamlCanonicalDialogWriterInput {
  readonly nodeId: NodeId;
  readonly mode: YamlCanonicalDialogWriteMode;
  readonly filename: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly payload: unknown;
}

/** The single atomic-shaped request emitted to the injected write port. */
export interface YamlCanonicalDialogWriteRequest {
  readonly nodeId: NodeId;
  readonly mode: YamlCanonicalDialogWriteMode;
  readonly draftMetadata: Readonly<{
    readonly name: string;
    readonly description: string;
    readonly tags: readonly string[];
  }>;
  readonly draftData: ValidatedYamlCanonicalPayload;
  readonly onNameConflict: 'error';
}

/** The only side-effect boundary used by the canonical writer. */
export type YamlCanonicalDialogWritePort = (
  request: YamlCanonicalDialogWriteRequest
) => Promise<void>;

export type YamlCanonicalDialogWriterInputField =
  | 'input'
  | 'nodeId'
  | 'mode'
  | 'filename'
  | 'description'
  | 'tags'
  | 'payload'
  | 'writePort';

export type YamlCanonicalDialogWriterInputReason =
  | 'missing'
  | 'undefined'
  | 'invalid-type'
  | 'empty'
  | 'invalid-value'
  | 'invalid-item'
  | 'unexpected-field'
  | 'accessor-property'
  | 'reflection-failure';

export type YamlCanonicalDialogWriterError =
  | Readonly<{
      readonly code: 'INVALID_INPUT';
      readonly context: Readonly<{
        readonly field: YamlCanonicalDialogWriterInputField;
        readonly reason: YamlCanonicalDialogWriterInputReason;
      }>;
    }>
  | Readonly<{
      readonly code: 'CANONICAL_VALIDATION_FAILED';
      readonly validationError: YamlCanonicalValidationError;
    }>
  | Readonly<{ readonly code: 'WRITE_PORT_FAILED' }>;

/** Stable, redacted result returned by the canonical dialog writer. */
export type YamlCanonicalDialogWriterResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly error: YamlCanonicalDialogWriterError }>;
