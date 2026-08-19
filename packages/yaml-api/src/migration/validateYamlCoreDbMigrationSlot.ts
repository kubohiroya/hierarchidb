import Ajv, { type ValidateFunction } from 'ajv';
import { parseAllDocuments } from 'yaml';
import { YAML_SCHEMAS } from '../YAML_SCHEMAS.js';
import { YAML_SUBTYPE_REGISTRY, type YamlSubtypeRegistryEntry } from '../YAML_SUBTYPE_REGISTRY.js';
import type {
  YamlCanonicalMigrationPayload,
  YamlCoreDbMigrationError,
  YamlCoreDbMigrationSlot,
  YamlLegacyMigrationPayload,
} from './yamlCoreDbMigrationTypes.js';

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

interface ValidatedLegacySlot {
  readonly classification: 'legacy';
  readonly preimage: YamlLegacyMigrationPayload;
  readonly postimage: YamlCanonicalMigrationPayload;
}

interface ValidatedCanonicalSlot {
  readonly classification: 'canonical';
}

export type ValidatedYamlCoreDbMigrationSlot = ValidatedLegacySlot | ValidatedCanonicalSlot;

export type ValidateYamlCoreDbMigrationSlotResult =
  | Readonly<{ readonly ok: true; readonly value: ValidatedYamlCoreDbMigrationSlot }>
  | Readonly<{ readonly ok: false; readonly error: YamlCoreDbMigrationError }>;

export function isPlainMigrationRecord(
  value: unknown
): value is Readonly<Record<PropertyKey, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export type YamlMigrationOwnProperty =
  | Readonly<{ readonly kind: 'missing' }>
  | Readonly<{ readonly kind: 'data'; readonly value: unknown }>
  | Readonly<{ readonly kind: 'accessor' }>;

export function readOwnMigrationProperty(
  value: Readonly<Record<PropertyKey, unknown>>,
  property: PropertyKey
): YamlMigrationOwnProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (descriptor === undefined) return { kind: 'missing' };
  if (!Object.hasOwn(descriptor, 'value')) return { kind: 'accessor' };
  return { kind: 'data', value: descriptor.value };
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

function validatePayloadKeySet(
  payload: Readonly<Record<PropertyKey, unknown>>,
  selector: 'name' | 'subtype',
  sourceIndex: number,
  nodeId: string,
  slot: YamlCoreDbMigrationSlot
): YamlCoreDbMigrationError | undefined {
  const expectedKeys = new Set<PropertyKey>([selector, 'schemaId', 'content']);
  const ownKeys = Reflect.ownKeys(payload);
  if (ownKeys.some((key) => readOwnMigrationProperty(payload, key).kind !== 'data')) {
    return createError(sourceIndex, nodeId, slot, 'UNSAFE_PROPERTY_DESCRIPTOR', {
      field: 'payload',
      reason: 'accessor-property',
    });
  }
  if (ownKeys.some((key) => !expectedKeys.has(key))) {
    return createError(sourceIndex, nodeId, slot, 'UNKNOWN_PAYLOAD_FIELD', {
      field: 'payload',
      reason: 'unexpected-field',
    });
  }
  if (ownKeys.length !== expectedKeys.size) {
    return createError(sourceIndex, nodeId, slot, 'INCOMPLETE_PAYLOAD', {
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
  schemaId: string,
  sourceIndex: number,
  nodeId: string,
  slot: YamlCoreDbMigrationSlot
): YamlCoreDbMigrationError | undefined {
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
    return createError(sourceIndex, nodeId, slot, 'INVALID_YAML', {
      field: 'content',
      reason: 'parse-failure',
    });
  }

  if (documents.length !== 1) {
    return createError(sourceIndex, nodeId, slot, 'MULTIPLE_YAML_DOCUMENTS', {
      field: 'content',
      reason: 'multiple-documents',
    });
  }

  const document = documents[0];
  if (document === undefined || document.errors.length > 0 || document.warnings.length > 0) {
    return createError(sourceIndex, nodeId, slot, 'INVALID_YAML', {
      field: 'content',
      reason: 'parse-failure',
    });
  }

  let parsedContent: unknown;
  try {
    parsedContent = document.toJS({ maxAliasCount: 100 });
  } catch {
    return createError(sourceIndex, nodeId, slot, 'INVALID_YAML', {
      field: 'content',
      reason: 'parse-failure',
    });
  }

  if (!isPlainMigrationRecord(parsedContent)) {
    return createError(sourceIndex, nodeId, slot, 'YAML_ROOT_NOT_MAPPING', {
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
    return createError(sourceIndex, nodeId, slot, 'CONTENT_SCHEMA_INVALID', {
      field: 'content',
      reason: 'schema-validation',
    });
  }
  return undefined;
}

/** Strictly validates one committed or draft YAML payload slot. */
export function validateYamlCoreDbMigrationSlot(
  payloadValue: unknown,
  metadataName: string,
  sourceIndex: number,
  nodeId: string,
  slot: YamlCoreDbMigrationSlot
): ValidateYamlCoreDbMigrationSlotResult {
  if (!isPlainMigrationRecord(payloadValue)) {
    return {
      ok: false,
      error: createError(sourceIndex, nodeId, slot, 'INVALID_PAYLOAD', {
        field: slot === 'committed' ? 'data' : 'draftData',
        reason: payloadValue === null ? 'null' : 'invalid-type',
      }),
    };
  }

  if (
    Reflect.ownKeys(payloadValue).some(
      (key) => readOwnMigrationProperty(payloadValue, key).kind !== 'data'
    )
  ) {
    return {
      ok: false,
      error: createError(sourceIndex, nodeId, slot, 'UNSAFE_PROPERTY_DESCRIPTOR', {
        field: 'payload',
        reason: 'accessor-property',
      }),
    };
  }

  const legacyNameProperty = readOwnMigrationProperty(payloadValue, 'name');
  const subtypeProperty = readOwnMigrationProperty(payloadValue, 'subtype');
  if (legacyNameProperty.kind === 'accessor' || subtypeProperty.kind === 'accessor') {
    return {
      ok: false,
      error: createError(sourceIndex, nodeId, slot, 'UNSAFE_PROPERTY_DESCRIPTOR', {
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
      error: createError(sourceIndex, nodeId, slot, 'MIXED_PAYLOAD', {
        field: 'payload',
      }),
    };
  }

  if (!hasLegacyName && !hasSubtype) {
    const allowedIncompleteKeys = new Set<PropertyKey>(['schemaId', 'content']);
    const hasUnexpectedKey = Reflect.ownKeys(payloadValue).some(
      (key) => !allowedIncompleteKeys.has(key)
    );
    return {
      ok: false,
      error: createError(
        sourceIndex,
        nodeId,
        slot,
        hasUnexpectedKey ? 'UNKNOWN_PAYLOAD_FIELD' : 'INCOMPLETE_PAYLOAD',
        {
          field: 'payload',
          reason: hasUnexpectedKey ? 'unexpected-field' : 'missing',
        }
      ),
    };
  }

  const selector = hasLegacyName ? 'name' : 'subtype';
  const keySetError = validatePayloadKeySet(payloadValue, selector, sourceIndex, nodeId, slot);
  if (keySetError !== undefined) {
    return { ok: false, error: keySetError };
  }

  const selectorProperty = readOwnMigrationProperty(payloadValue, selector);
  const schemaIdProperty = readOwnMigrationProperty(payloadValue, 'schemaId');
  const contentProperty = readOwnMigrationProperty(payloadValue, 'content');
  if (
    selectorProperty.kind !== 'data' ||
    schemaIdProperty.kind !== 'data' ||
    contentProperty.kind !== 'data'
  ) {
    return {
      ok: false,
      error: createError(sourceIndex, nodeId, slot, 'UNSAFE_PROPERTY_DESCRIPTOR', {
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
      error: createError(sourceIndex, nodeId, slot, 'INVALID_PAYLOAD_FIELD', {
        field: selector,
        reason: selectorValue === '' ? 'empty' : 'invalid-type',
      }),
    };
  }
  if (typeof schemaId !== 'string' || schemaId.length === 0) {
    return {
      ok: false,
      error: createError(sourceIndex, nodeId, slot, 'INVALID_PAYLOAD_FIELD', {
        field: 'schemaId',
        reason: schemaId === '' ? 'empty' : 'invalid-type',
      }),
    };
  }
  if (typeof content !== 'string') {
    return {
      ok: false,
      error: createError(sourceIndex, nodeId, slot, 'INVALID_PAYLOAD_FIELD', {
        field: 'content',
        reason: 'invalid-type',
      }),
    };
  }

  let registryEntry: YamlSubtypeRegistryEntry;
  let preimage: YamlLegacyMigrationPayload | undefined;
  if (selector === 'name') {
    if (selectorValue !== metadataName) {
      return {
        ok: false,
        error: createError(sourceIndex, nodeId, slot, 'METADATA_PAYLOAD_NAME_MISMATCH', {
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
          sourceIndex,
          nodeId,
          slot,
          entries.length === 0 ? 'UNKNOWN_REGISTRY_TUPLE' : 'AMBIGUOUS_REGISTRY_TUPLE',
          { field: 'payload', reason: 'registry-mismatch' }
        ),
      };
    }
    const matchedEntry = entries[0];
    if (matchedEntry === undefined) {
      return {
        ok: false,
        error: createError(sourceIndex, nodeId, slot, 'UNKNOWN_REGISTRY_TUPLE', {
          field: 'payload',
          reason: 'registry-mismatch',
        }),
      };
    }
    registryEntry = matchedEntry;
    preimage = { name: selectorValue, schemaId, content };
  } else {
    const matchedEntry = findCanonicalRegistryEntry(selectorValue);
    if (
      matchedEntry === undefined ||
      matchedEntry.schemaId !== schemaId ||
      matchedEntry.fileName !== metadataName
    ) {
      return {
        ok: false,
        error: createError(sourceIndex, nodeId, slot, 'UNKNOWN_REGISTRY_TUPLE', {
          field: 'payload',
          reason: 'registry-mismatch',
        }),
      };
    }
    registryEntry = matchedEntry;
  }

  const contentError = validateYamlContent(content, schemaId, sourceIndex, nodeId, slot);
  if (contentError !== undefined) {
    return { ok: false, error: contentError };
  }

  if (preimage === undefined) {
    return { ok: true, value: { classification: 'canonical' } };
  }
  return {
    ok: true,
    value: {
      classification: 'legacy',
      preimage,
      postimage: {
        subtype: registryEntry.subtype,
        schemaId,
        content,
      },
    },
  };
}
