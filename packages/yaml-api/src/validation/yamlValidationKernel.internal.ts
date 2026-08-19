import Ajv, { type ValidateFunction } from 'ajv';
import { parseAllDocuments } from 'yaml';
import { YAML_SCHEMAS } from '../YAML_SCHEMAS.js';
import { YAML_SUBTYPE_REGISTRY, type YamlSubtypeRegistryEntry } from '../YAML_SUBTYPE_REGISTRY.js';
import type { ValidatedYamlCanonicalPayload } from './yamlCanonicalValidationTypes.js';

const ajv = new Ajv({
  strict: true,
  allErrors: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
});

const schemaValidators = new Map<string, ValidateFunction>(
  Object.entries(YAML_SCHEMAS).map(([schemaId, schema]) => [schemaId, ajv.compile(schema)])
);

export type YamlValidationKernelErrorCode =
  | 'INVALID_PAYLOAD'
  | 'LEGACY_PAYLOAD'
  | 'MIXED_PAYLOAD'
  | 'INCOMPLETE_PAYLOAD'
  | 'UNKNOWN_PAYLOAD_FIELD'
  | 'INVALID_PAYLOAD_FIELD'
  | 'METADATA_PAYLOAD_NAME_MISMATCH'
  | 'UNKNOWN_REGISTRY_TUPLE'
  | 'AMBIGUOUS_REGISTRY_TUPLE'
  | 'INVALID_YAML'
  | 'MULTIPLE_YAML_DOCUMENTS'
  | 'YAML_ROOT_NOT_MAPPING'
  | 'CONTENT_SCHEMA_INVALID'
  | 'UNSAFE_PROPERTY_DESCRIPTOR'
  | 'REFLECTION_FAILED';

export interface YamlValidationKernelError {
  readonly code: YamlValidationKernelErrorCode;
  readonly context?: Readonly<{
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
  }>;
}

interface ValidatedLegacyPayload {
  readonly classification: 'legacy';
  readonly preimage: Readonly<{
    readonly name: string;
    readonly schemaId: string;
    readonly content: string;
  }>;
  readonly postimage: ValidatedYamlCanonicalPayload;
}

interface ValidatedCanonicalPayload {
  readonly classification: 'canonical';
  readonly payload: ValidatedYamlCanonicalPayload;
}

export type ValidatedYamlPayload = ValidatedLegacyPayload | ValidatedCanonicalPayload;

export type ValidateYamlPayloadWithKernelResult =
  | Readonly<{ readonly ok: true; readonly value: ValidatedYamlPayload }>
  | Readonly<{ readonly ok: false; readonly error: YamlValidationKernelError }>;

export type YamlValidationOwnProperty =
  | Readonly<{ readonly kind: 'missing' }>
  | Readonly<{ readonly kind: 'data'; readonly value: unknown }>
  | Readonly<{ readonly kind: 'accessor' }>;

export function isPlainYamlValidationRecord(
  value: unknown
): value is Readonly<Record<PropertyKey, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function readOwnYamlValidationProperty(
  value: Readonly<Record<PropertyKey, unknown>>,
  property: PropertyKey
): YamlValidationOwnProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (descriptor === undefined) return { kind: 'missing' };
  if (!Object.hasOwn(descriptor, 'value')) return { kind: 'accessor' };
  return { kind: 'data', value: descriptor.value };
}

function createError(
  code: YamlValidationKernelErrorCode,
  context?: YamlValidationKernelError['context']
): YamlValidationKernelError {
  return context === undefined ? { code } : { code, context };
}

function validatePayloadKeySet(
  payload: Readonly<Record<PropertyKey, unknown>>,
  selector: 'name' | 'subtype'
): YamlValidationKernelError | undefined {
  const expectedKeys = new Set<PropertyKey>([selector, 'schemaId', 'content']);
  const ownKeys = Reflect.ownKeys(payload);
  if (ownKeys.some((key) => readOwnYamlValidationProperty(payload, key).kind !== 'data')) {
    return createError('UNSAFE_PROPERTY_DESCRIPTOR', {
      field: 'payload',
      reason: 'accessor-property',
    });
  }
  if (ownKeys.some((key) => !expectedKeys.has(key))) {
    return createError('UNKNOWN_PAYLOAD_FIELD', {
      field: 'payload',
      reason: 'unexpected-field',
    });
  }
  if (ownKeys.length !== expectedKeys.size) {
    return createError('INCOMPLETE_PAYLOAD', {
      field: 'payload',
      reason: 'missing',
    });
  }
  return undefined;
}

function findLegacyRegistryEntry(
  filename: string,
  schemaId: string
): readonly YamlSubtypeRegistryEntry[] {
  return Object.values(YAML_SUBTYPE_REGISTRY).filter(
    (entry) => entry.fileName === filename && entry.schemaId === schemaId
  );
}

function findCanonicalRegistryEntry(subtype: string): YamlSubtypeRegistryEntry | undefined {
  return Object.values(YAML_SUBTYPE_REGISTRY).find((entry) => entry.subtype === subtype);
}

function validateYamlContent(
  content: string,
  schemaId: string
): YamlValidationKernelError | undefined {
  const documents = (() => {
    try {
      return parseAllDocuments(content, {
        strict: true,
        uniqueKeys: true,
        version: '1.2',
        schema: 'core',
        merge: false,
        stringKeys: true,
      });
    } catch {
      return undefined;
    }
  })();
  if (documents === undefined) {
    return createError('INVALID_YAML', { field: 'content', reason: 'parse-failure' });
  }
  if (documents.length !== 1) {
    return createError('MULTIPLE_YAML_DOCUMENTS', {
      field: 'content',
      reason: 'multiple-documents',
    });
  }

  const document = documents[0];
  if (document === undefined || document.errors.length > 0 || document.warnings.length > 0) {
    return createError('INVALID_YAML', { field: 'content', reason: 'parse-failure' });
  }

  let parsedContent: unknown;
  try {
    parsedContent = document.toJS({ maxAliasCount: 100 });
  } catch {
    return createError('INVALID_YAML', { field: 'content', reason: 'parse-failure' });
  }
  if (!isPlainYamlValidationRecord(parsedContent)) {
    return createError('YAML_ROOT_NOT_MAPPING', {
      field: 'content',
      reason: 'non-mapping-root',
    });
  }

  const validator = schemaValidators.get(schemaId);
  let schemaIsValid = false;
  try {
    if (validator !== undefined) {
      schemaIsValid = validator(parsedContent);
    }
  } catch {
    schemaIsValid = false;
  }
  if (!schemaIsValid) {
    return createError('CONTENT_SCHEMA_INVALID', {
      field: 'content',
      reason: 'schema-validation',
    });
  }
  return undefined;
}

function validateYamlPayload(
  payloadValue: unknown,
  metadataName: string,
  mode: 'canonical-only' | 'migration'
): ValidateYamlPayloadWithKernelResult {
  if (!isPlainYamlValidationRecord(payloadValue)) {
    return {
      ok: false,
      error: createError('INVALID_PAYLOAD', {
        field: 'payload',
        reason: payloadValue === null ? 'null' : 'invalid-type',
      }),
    };
  }

  if (
    Reflect.ownKeys(payloadValue).some(
      (key) => readOwnYamlValidationProperty(payloadValue, key).kind !== 'data'
    )
  ) {
    return {
      ok: false,
      error: createError('UNSAFE_PROPERTY_DESCRIPTOR', {
        field: 'payload',
        reason: 'accessor-property',
      }),
    };
  }

  const legacyNameProperty = readOwnYamlValidationProperty(payloadValue, 'name');
  const subtypeProperty = readOwnYamlValidationProperty(payloadValue, 'subtype');
  if (legacyNameProperty.kind === 'accessor' || subtypeProperty.kind === 'accessor') {
    return {
      ok: false,
      error: createError('UNSAFE_PROPERTY_DESCRIPTOR', {
        field: 'payload',
        reason: 'accessor-property',
      }),
    };
  }
  const hasLegacyName = legacyNameProperty.kind === 'data';
  const hasSubtype = subtypeProperty.kind === 'data';
  if (hasLegacyName && hasSubtype) {
    return {
      ok: false,
      error: createError('MIXED_PAYLOAD', { field: 'payload' }),
    };
  }
  if (hasLegacyName && mode === 'canonical-only') {
    return {
      ok: false,
      error: createError('LEGACY_PAYLOAD', { field: 'payload' }),
    };
  }
  if (!hasLegacyName && !hasSubtype) {
    const allowedIncompleteKeys = new Set<PropertyKey>(['schemaId', 'content']);
    const hasUnexpectedKey = Reflect.ownKeys(payloadValue).some(
      (key) => !allowedIncompleteKeys.has(key)
    );
    return {
      ok: false,
      error: createError(hasUnexpectedKey ? 'UNKNOWN_PAYLOAD_FIELD' : 'INCOMPLETE_PAYLOAD', {
        field: 'payload',
        reason: hasUnexpectedKey ? 'unexpected-field' : 'missing',
      }),
    };
  }

  const selector = hasLegacyName ? 'name' : 'subtype';
  const keySetError = validatePayloadKeySet(payloadValue, selector);
  if (keySetError !== undefined) {
    return { ok: false, error: keySetError };
  }

  const selectorProperty = readOwnYamlValidationProperty(payloadValue, selector);
  const schemaIdProperty = readOwnYamlValidationProperty(payloadValue, 'schemaId');
  const contentProperty = readOwnYamlValidationProperty(payloadValue, 'content');
  if (
    selectorProperty.kind !== 'data' ||
    schemaIdProperty.kind !== 'data' ||
    contentProperty.kind !== 'data'
  ) {
    return {
      ok: false,
      error: createError('UNSAFE_PROPERTY_DESCRIPTOR', {
        field: 'payload',
        reason: 'accessor-property',
      }),
    };
  }

  const selectorValue = selectorProperty.value;
  const schemaId = schemaIdProperty.value;
  const content = contentProperty.value;
  if (typeof selectorValue !== 'string' || selectorValue.length === 0) {
    return {
      ok: false,
      error: createError('INVALID_PAYLOAD_FIELD', {
        field: selector,
        reason: selectorValue === '' ? 'empty' : 'invalid-type',
      }),
    };
  }
  if (typeof schemaId !== 'string' || schemaId.length === 0) {
    return {
      ok: false,
      error: createError('INVALID_PAYLOAD_FIELD', {
        field: 'schemaId',
        reason: schemaId === '' ? 'empty' : 'invalid-type',
      }),
    };
  }
  if (typeof content !== 'string') {
    return {
      ok: false,
      error: createError('INVALID_PAYLOAD_FIELD', {
        field: 'content',
        reason: 'invalid-type',
      }),
    };
  }

  let registryEntry: YamlSubtypeRegistryEntry;
  let legacyName: string | undefined;
  if (selector === 'name') {
    if (selectorValue !== metadataName) {
      return {
        ok: false,
        error: createError('METADATA_PAYLOAD_NAME_MISMATCH', {
          field: 'name',
          reason: 'name-mismatch',
        }),
      };
    }
    const entries = findLegacyRegistryEntry(selectorValue, schemaId);
    if (entries.length !== 1) {
      return {
        ok: false,
        error: createError(
          entries.length === 0 ? 'UNKNOWN_REGISTRY_TUPLE' : 'AMBIGUOUS_REGISTRY_TUPLE',
          { field: 'payload', reason: 'registry-mismatch' }
        ),
      };
    }
    const matchedEntry = entries[0];
    if (matchedEntry === undefined) {
      return {
        ok: false,
        error: createError('UNKNOWN_REGISTRY_TUPLE', {
          field: 'payload',
          reason: 'registry-mismatch',
        }),
      };
    }
    registryEntry = matchedEntry;
    legacyName = selectorValue;
  } else {
    const matchedEntry = findCanonicalRegistryEntry(selectorValue);
    if (
      matchedEntry === undefined ||
      matchedEntry.schemaId !== schemaId ||
      matchedEntry.fileName !== metadataName
    ) {
      return {
        ok: false,
        error: createError('UNKNOWN_REGISTRY_TUPLE', {
          field: 'payload',
          reason: 'registry-mismatch',
        }),
      };
    }
    registryEntry = matchedEntry;
  }

  const contentError = validateYamlContent(content, schemaId);
  if (contentError !== undefined) {
    return { ok: false, error: contentError };
  }

  const canonicalPayload: ValidatedYamlCanonicalPayload = {
    subtype: registryEntry.subtype,
    schemaId,
    content,
  };
  if (legacyName === undefined) {
    return {
      ok: true,
      value: { classification: 'canonical', payload: canonicalPayload },
    };
  }
  return {
    ok: true,
    value: {
      classification: 'legacy',
      preimage: { name: legacyName, schemaId, content },
      postimage: canonicalPayload,
    },
  };
}

/** Package-private validation authority shared by public validation and migration adapters. */
export function yamlValidationKernel(
  payloadValue: unknown,
  metadataName: string,
  mode: 'canonical-only' | 'migration'
): ValidateYamlPayloadWithKernelResult {
  try {
    return validateYamlPayload(payloadValue, metadataName, mode);
  } catch {
    return {
      ok: false,
      error: createError('REFLECTION_FAILED', {
        field: 'payload',
        reason: 'reflection-failure',
      }),
    };
  }
}
