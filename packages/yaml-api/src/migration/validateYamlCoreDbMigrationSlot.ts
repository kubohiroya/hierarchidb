import {
  isPlainYamlValidationRecord,
  readOwnYamlValidationProperty,
  type YamlValidationOwnProperty,
  yamlValidationKernel,
} from '../validation/yamlValidationKernel.internal.js';
import type {
  YamlCanonicalMigrationPayload,
  YamlCoreDbMigrationError,
  YamlCoreDbMigrationSlot,
  YamlHostSplitLegacyMigrationPayload,
  YamlLegacyMigrationPayload,
} from './yamlCoreDbMigrationTypes.js';

interface ValidatedLegacySlot {
  readonly classification: 'legacy';
  readonly preimage: YamlLegacyMigrationPayload;
  readonly postimage: YamlCanonicalMigrationPayload;
}

interface ValidatedCanonicalSlot {
  readonly classification: 'canonical';
}

interface ValidatedHostSplitLegacySlot {
  readonly classification: 'host-split-legacy';
  readonly preimage: YamlHostSplitLegacyMigrationPayload;
  readonly legacyName: string;
  readonly postimage: YamlCanonicalMigrationPayload;
}

export type ValidatedYamlCoreDbMigrationSlot =
  | ValidatedLegacySlot
  | ValidatedHostSplitLegacySlot
  | ValidatedCanonicalSlot;

export type ValidateYamlCoreDbMigrationSlotResult =
  | Readonly<{ readonly ok: true; readonly value: ValidatedYamlCoreDbMigrationSlot }>
  | Readonly<{ readonly ok: false; readonly error: YamlCoreDbMigrationError }>;

export function isPlainMigrationRecord(
  value: unknown
): value is Readonly<Record<PropertyKey, unknown>> {
  return isPlainYamlValidationRecord(value);
}

export type YamlMigrationOwnProperty = YamlValidationOwnProperty;

export function readOwnMigrationProperty(
  value: Readonly<Record<PropertyKey, unknown>>,
  property: PropertyKey
): YamlMigrationOwnProperty {
  return readOwnYamlValidationProperty(value, property);
}

function createError(
  sourceIndex: number,
  nodeId: string,
  slot: YamlCoreDbMigrationSlot,
  code: YamlCoreDbMigrationError['code'],
  context?: YamlCoreDbMigrationError['context']
): YamlCoreDbMigrationError {
  return context === undefined
    ? { sourceIndex, nodeId, slot, code }
    : { sourceIndex, nodeId, slot, code, context };
}

function toMigrationErrorContext(
  context:
    | Readonly<{
        readonly field?: 'payload' | 'name' | 'subtype' | 'schemaId' | 'content';
        readonly reason?:
          | 'missing'
          | 'null'
          | 'invalid-type'
          | 'empty'
          | 'unexpected-field'
          | 'name-mismatch'
          | 'registry-mismatch'
          | 'schema-validation'
          | 'parse-failure'
          | 'multiple-documents'
          | 'non-mapping-root'
          | 'accessor-property'
          | 'reflection-failure';
      }>
    | undefined
): YamlCoreDbMigrationError['context'] {
  if (context === undefined) return undefined;
  const reason = context.reason;
  if (reason === 'reflection-failure') {
    throw new Error('YAML payload reflection failed');
  }
  if (reason === undefined) {
    return context.field === undefined ? {} : { field: context.field };
  }
  return context.field === undefined ? { reason } : { field: context.field, reason };
}

/** Strictly validates one committed or draft YAML payload slot. */
export function validateYamlCoreDbMigrationSlot(
  payloadValue: unknown,
  metadataName: string,
  sourceIndex: number,
  nodeId: string,
  slot: YamlCoreDbMigrationSlot
): ValidateYamlCoreDbMigrationSlotResult {
  const result = yamlValidationKernel(payloadValue, metadataName, 'migration');
  if (!result.ok) {
    if (result.error.code === 'REFLECTION_FAILED' || result.error.code === 'LEGACY_PAYLOAD') {
      throw new Error('YAML payload reflection failed');
    }
    const neutralContext = toMigrationErrorContext(result.error.context);
    const context =
      result.error.code === 'INVALID_PAYLOAD'
        ? {
            ...neutralContext,
            field: slot === 'committed' ? ('data' as const) : ('draftData' as const),
          }
        : neutralContext;
    return {
      ok: false,
      error: createError(sourceIndex, nodeId, slot, result.error.code, context),
    };
  }

  if (result.value.classification === 'canonical') {
    return { ok: true, value: { classification: 'canonical' } };
  }
  if (result.value.classification === 'host-split-legacy') {
    return {
      ok: true,
      value: {
        classification: 'host-split-legacy',
        preimage: result.value.preimage,
        legacyName: result.value.legacyName,
        postimage: result.value.postimage,
      },
    };
  }
  return {
    ok: true,
    value: {
      classification: 'legacy',
      preimage: result.value.preimage,
      postimage: result.value.postimage,
    },
  };
}
