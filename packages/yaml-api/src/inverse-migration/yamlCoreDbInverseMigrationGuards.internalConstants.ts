import { validateYamlCanonicalPayload } from '../validation/validateYamlCanonicalPayload.js';
import type {
  ValidatedYamlCanonicalPayload,
  YamlCanonicalValidationError,
} from '../validation/yamlCanonicalValidationTypes.js';
import type {
  YamlCanonicalInverseMigrationPayload,
  YamlCoreDbInverseMigrationError,
  YamlCoreDbInverseMigrationNodeGuard,
  YamlCoreDbInverseMigrationSlot,
  YamlCoreDbInverseMigrationValidatedNoop,
  YamlLegacyInverseMigrationPayload,
} from './yamlCoreDbInverseMigrationTypes.js';

type YamlInverseOwnProperty =
  | Readonly<{ readonly kind: 'missing' }>
  | Readonly<{ readonly kind: 'data'; readonly value: unknown }>
  | Readonly<{ readonly kind: 'accessor' }>;

interface InspectedYamlInverseSlot {
  readonly sourceIndex: number;
  readonly nodeId: string;
  readonly slot: YamlCoreDbInverseMigrationSlot;
  readonly filename: string;
  readonly payload: YamlCanonicalInverseMigrationPayload;
}

interface InspectedYamlInverseNodes {
  readonly slots: readonly InspectedYamlInverseSlot[];
  readonly nodeGuards: readonly YamlCoreDbInverseMigrationNodeGuard[];
  readonly structuralNoops: readonly YamlCoreDbInverseMigrationValidatedNoop[];
}

type InspectYamlInverseNodesResult =
  | Readonly<{ readonly ok: true; readonly value: InspectedYamlInverseNodes }>
  | Readonly<{ readonly ok: false; readonly errors: readonly YamlCoreDbInverseMigrationError[] }>;

type ReadStrictInverseInputResult =
  | Readonly<{
      readonly ok: true;
      readonly values: Readonly<Record<string, unknown>>;
    }>
  | Readonly<{ readonly ok: false; readonly error: YamlCoreDbInverseMigrationError }>;

interface ValidMetadata {
  readonly name: string;
}

const NODE_KEYS = new Set<PropertyKey>([
  'id',
  'parentId',
  'nodeType',
  'depth',
  'createdAt',
  'updatedAt',
  'version',
  'metadata',
  'draftMetadata',
  'data',
  'draftData',
  'isTemporary',
  'visible',
  'dialogUIState',
  'hasChildren',
  'descendantCount',
  'isEstimated',
  'references',
  'originalName',
  'originalParentId',
  'removedAt',
  'lastTouchedAt',
  'map',
  'viewProperties',
]);

const METADATA_KEYS = new Set<PropertyKey>(['name', 'description', 'tags', 'buildMetadata']);

const SLOT_ORDER: Readonly<Record<YamlCoreDbInverseMigrationSlot, number>> = {
  committed: 0,
  draft: 1,
};

function compareNodeId(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareNodeSlot(
  left: Readonly<{ readonly nodeId: string; readonly slot: YamlCoreDbInverseMigrationSlot }>,
  right: Readonly<{ readonly nodeId: string; readonly slot: YamlCoreDbInverseMigrationSlot }>
): number {
  const nodeComparison = compareNodeId(left.nodeId, right.nodeId);
  return nodeComparison === 0 ? SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot] : nodeComparison;
}

function inverseSlotKey(nodeId: string, slot: YamlCoreDbInverseMigrationSlot): string {
  return `${nodeId}\u0000${slot}`;
}

function isPlainInverseRecord(value: unknown): value is Readonly<Record<PropertyKey, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readOwnInverseProperty(
  value: Readonly<Record<PropertyKey, unknown>>,
  property: PropertyKey
): YamlInverseOwnProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (descriptor === undefined) return { kind: 'missing' };
  if (!Object.hasOwn(descriptor, 'value')) return { kind: 'accessor' };
  return { kind: 'data', value: descriptor.value };
}

function createInverseInputError(
  code: YamlCoreDbInverseMigrationError['code'],
  field: NonNullable<YamlCoreDbInverseMigrationError['context']>['field'],
  reason: NonNullable<YamlCoreDbInverseMigrationError['context']>['reason'] = 'invalid-type'
): YamlCoreDbInverseMigrationError {
  return { sourceIndex: -1, slot: 'input', code, context: { field, reason } };
}

function readStrictInverseInputProperties(
  inputValue: unknown,
  expectedKeys: readonly string[]
): ReadStrictInverseInputResult {
  try {
    if (!isPlainInverseRecord(inputValue)) {
      return {
        ok: false,
        error: createInverseInputError(
          'INVALID_INPUT',
          'input',
          inputValue === null ? 'null' : 'invalid-type'
        ),
      };
    }
    const expectedKeySet = new Set<PropertyKey>(expectedKeys);
    const ownKeys = Reflect.ownKeys(inputValue);
    if (ownKeys.length !== expectedKeys.length || ownKeys.some((key) => !expectedKeySet.has(key))) {
      return {
        ok: false,
        error: createInverseInputError('INVALID_INPUT', 'input', 'unexpected-field'),
      };
    }
    const values: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const property = readOwnInverseProperty(inputValue, key);
      if (property.kind !== 'data') {
        return {
          ok: false,
          error: createInverseInputError(
            'INVALID_INPUT',
            'input',
            property.kind === 'missing' ? 'missing' : 'accessor-property'
          ),
        };
      }
      values[key] = property.value;
    }
    return { ok: true, values: Object.freeze(values) };
  } catch {
    return {
      ok: false,
      error: createInverseInputError('INVALID_INPUT', 'input', 'reflection-failure'),
    };
  }
}

function createInverseError(
  sourceIndex: number,
  nodeId: string | undefined,
  slot: YamlCoreDbInverseMigrationError['slot'],
  code: YamlCoreDbInverseMigrationError['code'],
  context?: YamlCoreDbInverseMigrationError['context']
): YamlCoreDbInverseMigrationError {
  const common = { sourceIndex, slot, code };
  if (nodeId === undefined && context === undefined) return common;
  if (nodeId === undefined) return { ...common, context };
  if (context === undefined) return { ...common, nodeId };
  return { ...common, nodeId, context };
}

function sortInverseErrors(errors: YamlCoreDbInverseMigrationError[]): void {
  const errorSlotOrder: Readonly<Record<YamlCoreDbInverseMigrationError['slot'], number>> = {
    input: -3,
    journal: -2,
    node: -1,
    committed: 0,
    draft: 1,
  };
  errors.sort((left, right) => {
    if (left.nodeId !== undefined && right.nodeId !== undefined) {
      const nodeComparison = compareNodeId(left.nodeId, right.nodeId);
      if (nodeComparison !== 0) return nodeComparison;
    } else if (left.nodeId !== undefined) {
      return -1;
    } else if (right.nodeId !== undefined) {
      return 1;
    }
    const slotComparison = errorSlotOrder[left.slot] - errorSlotOrder[right.slot];
    if (slotComparison !== 0) return slotComparison;
    if (left.sourceIndex !== right.sourceIndex) return left.sourceIndex - right.sourceIndex;
    return left.code.localeCompare(right.code);
  });
}

function freezeInverseErrors(
  errors: readonly YamlCoreDbInverseMigrationError[]
): readonly YamlCoreDbInverseMigrationError[] {
  return Object.freeze(
    errors.map((error) =>
      Object.freeze({
        ...error,
        ...(error.context === undefined ? {} : { context: Object.freeze({ ...error.context }) }),
      })
    )
  );
}

function freezeCanonicalPayload(
  payload: ValidatedYamlCanonicalPayload
): YamlCanonicalInverseMigrationPayload {
  return Object.freeze({
    subtype: payload.subtype,
    schemaId: payload.schemaId,
    content: payload.content,
  });
}

function createFrozenLegacyPayload(
  name: string,
  payload: YamlCanonicalInverseMigrationPayload
): YamlLegacyInverseMigrationPayload {
  return Object.freeze({ name, schemaId: payload.schemaId, content: payload.content });
}

function freezeValidatedNoop(
  noop: YamlCoreDbInverseMigrationValidatedNoop
): YamlCoreDbInverseMigrationValidatedNoop {
  return Object.freeze({ ...noop });
}

function validationErrorContext(
  error: YamlCanonicalValidationError
): YamlCoreDbInverseMigrationError['context'] {
  if (error.context === undefined) return undefined;
  const field = error.context.field === 'filename' ? 'payload' : error.context.field;
  return Object.freeze({ ...error.context, field });
}

function validateCanonicalSlot(
  payloadValue: unknown,
  metadataName: string,
  sourceIndex: number,
  nodeId: string,
  slot: YamlCoreDbInverseMigrationSlot,
  slots: InspectedYamlInverseSlot[],
  errors: YamlCoreDbInverseMigrationError[]
): boolean {
  const result = validateYamlCanonicalPayload(metadataName, payloadValue);
  if (!result.ok) {
    const code = result.error.code === 'INVALID_FILENAME' ? 'INVALID_PAYLOAD' : result.error.code;
    errors.push(
      createInverseError(sourceIndex, nodeId, slot, code, validationErrorContext(result.error))
    );
    return false;
  }
  slots.push(
    Object.freeze({
      sourceIndex,
      nodeId,
      slot,
      filename: metadataName,
      payload: freezeCanonicalPayload(result.value),
    })
  );
  return true;
}

function validateMetadata(
  value: unknown,
  sourceIndex: number,
  nodeId: string,
  slot: 'node' | 'draft'
):
  | Readonly<{ readonly ok: true; readonly value: ValidMetadata }>
  | Readonly<{ readonly ok: false; readonly error: YamlCoreDbInverseMigrationError }> {
  const isDraft = slot === 'draft';
  const metadataField = isDraft ? ('draftMetadata' as const) : ('metadata' as const);
  try {
    if (!isPlainInverseRecord(value)) {
      return {
        ok: false,
        error: createInverseError(
          sourceIndex,
          nodeId,
          slot,
          isDraft ? 'INVALID_DRAFT_METADATA' : 'INVALID_METADATA',
          {
            field: metadataField,
            reason: value === null ? 'null' : 'invalid-type',
          }
        ),
      };
    }
    const ownKeys = Reflect.ownKeys(value);
    for (const key of ownKeys) {
      const property = readOwnInverseProperty(value, key);
      if (property.kind !== 'data') {
        return {
          ok: false,
          error: createInverseError(sourceIndex, nodeId, slot, 'UNSAFE_PROPERTY_DESCRIPTOR', {
            field: metadataField,
            reason: 'accessor-property',
          }),
        };
      }
      if (!METADATA_KEYS.has(key)) {
        return {
          ok: false,
          error: createInverseError(sourceIndex, nodeId, slot, 'UNKNOWN_METADATA_FIELD', {
            field: metadataField,
            reason: 'unexpected-field',
          }),
        };
      }
    }
    const nameProperty = readOwnInverseProperty(value, 'name');
    if (nameProperty.kind === 'accessor') {
      return {
        ok: false,
        error: createInverseError(sourceIndex, nodeId, slot, 'UNSAFE_PROPERTY_DESCRIPTOR', {
          field: metadataField,
          reason: 'accessor-property',
        }),
      };
    }
    const name = nameProperty.kind === 'data' ? nameProperty.value : undefined;
    if (typeof name !== 'string' || name.length === 0) {
      return {
        ok: false,
        error: createInverseError(
          sourceIndex,
          nodeId,
          slot,
          isDraft ? 'INVALID_DRAFT_METADATA_NAME' : 'INVALID_METADATA_NAME',
          {
            field: metadataField,
            reason:
              nameProperty.kind === 'missing'
                ? 'missing'
                : name === undefined
                  ? 'undefined'
                  : name === ''
                    ? 'empty'
                    : 'invalid-type',
          }
        ),
      };
    }
    return { ok: true, value: Object.freeze({ name }) };
  } catch {
    return {
      ok: false,
      error: createInverseError(sourceIndex, nodeId, slot, 'RAW_RECORD_ACCESS_FAILED', {
        field: metadataField,
        reason: 'reflection-failure',
      }),
    };
  }
}

function readSnapshotArray(
  value: unknown,
  field: 'rawNodes' | 'rawJournalEntries',
  invalidCode: 'INVALID_RAW_NODES' | 'INVALID_RAW_JOURNAL'
):
  | Readonly<{ readonly ok: true; readonly values: readonly unknown[] }>
  | Readonly<{ readonly ok: false; readonly error: YamlCoreDbInverseMigrationError }> {
  try {
    if (!Array.isArray(value)) {
      return { ok: false, error: createInverseInputError(invalidCode, field) };
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      !Object.hasOwn(lengthDescriptor, 'value') ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      typeof lengthDescriptor.value !== 'number' ||
      lengthDescriptor.value < 0
    ) {
      return { ok: false, error: createInverseInputError(invalidCode, field) };
    }
    const length = lengthDescriptor.value;
    const allowedKeys = new Set<PropertyKey>(['length']);
    for (let sourceIndex = 0; sourceIndex < length; sourceIndex += 1) {
      allowedKeys.add(String(sourceIndex));
    }
    for (const key of Reflect.ownKeys(value)) {
      if (!allowedKeys.has(key)) {
        return {
          ok: false,
          error: createInverseInputError(invalidCode, field, 'unexpected-field'),
        };
      }
    }
    const values: unknown[] = [];
    for (let sourceIndex = 0; sourceIndex < length; sourceIndex += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(sourceIndex));
      if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) {
        return {
          ok: false,
          error: createInverseInputError(
            invalidCode,
            field,
            descriptor === undefined ? 'missing' : 'accessor-property'
          ),
        };
      }
      values.push(descriptor.value);
    }
    return { ok: true, values: Object.freeze(values) };
  } catch {
    return {
      ok: false,
      error: createInverseInputError(invalidCode, field, 'reflection-failure'),
    };
  }
}

function readRawInverseSnapshotArray(
  value: unknown,
  field: 'rawNodes' | 'rawJournalEntries',
  invalidCode: 'INVALID_RAW_NODES' | 'INVALID_RAW_JOURNAL'
): ReturnType<typeof readSnapshotArray> {
  return readSnapshotArray(value, field, invalidCode);
}

/** Inspects all raw YAML nodes and validates every present payload as canonical. */
function inspectYamlCoreDbInverseNodes(rawNodes: unknown): InspectYamlInverseNodesResult {
  const snapshotResult = readSnapshotArray(rawNodes, 'rawNodes', 'INVALID_RAW_NODES');
  if (!snapshotResult.ok) {
    return { ok: false, errors: freezeInverseErrors([snapshotResult.error]) };
  }

  const slots: InspectedYamlInverseSlot[] = [];
  const structuralNoops: YamlCoreDbInverseMigrationValidatedNoop[] = [];
  const nodeGuards: YamlCoreDbInverseMigrationNodeGuard[] = [];
  const errors: YamlCoreDbInverseMigrationError[] = [];
  const nodeIdSources = new Map<string, number[]>();

  for (let sourceIndex = 0; sourceIndex < snapshotResult.values.length; sourceIndex += 1) {
    const rawNode = snapshotResult.values[sourceIndex];
    let accessibleNodeId: string | undefined;
    try {
      if (!isPlainInverseRecord(rawNode)) {
        errors.push(
          createInverseError(sourceIndex, undefined, 'node', 'INVALID_RAW_NODE', {
            reason: rawNode === null ? 'null' : 'invalid-type',
          })
        );
        continue;
      }

      const ownKeys = Reflect.ownKeys(rawNode);
      let unsafeProperty = false;
      let unknownProperty = false;
      for (const key of ownKeys) {
        if (readOwnInverseProperty(rawNode, key).kind !== 'data') unsafeProperty = true;
        if (!NODE_KEYS.has(key)) unknownProperty = true;
      }
      if (unsafeProperty) {
        errors.push(
          createInverseError(sourceIndex, undefined, 'node', 'UNSAFE_PROPERTY_DESCRIPTOR', {
            reason: 'accessor-property',
          })
        );
        continue;
      }
      if (unknownProperty) {
        errors.push(
          createInverseError(sourceIndex, undefined, 'node', 'UNKNOWN_RAW_NODE_FIELD', {
            reason: 'unexpected-field',
          })
        );
        continue;
      }

      const nodeIdProperty = readOwnInverseProperty(rawNode, 'id');
      const rawNodeId = nodeIdProperty.kind === 'data' ? nodeIdProperty.value : undefined;
      const nodeId = typeof rawNodeId === 'string' && rawNodeId.length > 0 ? rawNodeId : undefined;
      if (nodeId === undefined) {
        errors.push(
          createInverseError(sourceIndex, undefined, 'node', 'INVALID_NODE_ID', {
            field: 'id',
            reason:
              nodeIdProperty.kind === 'missing'
                ? 'missing'
                : rawNodeId === undefined
                  ? 'undefined'
                  : rawNodeId === ''
                    ? 'empty'
                    : 'invalid-type',
          })
        );
        continue;
      }
      accessibleNodeId = nodeId;
      const duplicateSources = nodeIdSources.get(nodeId);
      if (duplicateSources === undefined) nodeIdSources.set(nodeId, [sourceIndex]);
      else duplicateSources.push(sourceIndex);

      const versionProperty = readOwnInverseProperty(rawNode, 'version');
      const version = versionProperty.kind === 'data' ? versionProperty.value : undefined;
      if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
        errors.push(
          createInverseError(sourceIndex, nodeId, 'node', 'INVALID_NODE_VERSION', {
            field: 'version',
            reason:
              versionProperty.kind === 'missing'
                ? 'missing'
                : version === undefined
                  ? 'undefined'
                  : 'invalid-type',
          })
        );
        continue;
      }
      nodeGuards.push(Object.freeze({ sourceIndex, nodeId, expectedVersion: version }));

      const nodeTypeProperty = readOwnInverseProperty(rawNode, 'nodeType');
      if (nodeTypeProperty.kind !== 'data' || nodeTypeProperty.value !== 'yaml-file') {
        errors.push(
          createInverseError(sourceIndex, nodeId, 'node', 'INVALID_NODE_TYPE', {
            field: 'nodeType',
            reason: nodeTypeProperty.kind === 'missing' ? 'missing' : 'invalid-type',
          })
        );
        continue;
      }

      const metadataProperty = readOwnInverseProperty(rawNode, 'metadata');
      const metadataResult = validateMetadata(
        metadataProperty.kind === 'data' ? metadataProperty.value : undefined,
        sourceIndex,
        nodeId,
        'node'
      );
      if (!metadataResult.ok) {
        errors.push(metadataResult.error);
        continue;
      }

      const draftMetadataProperty = readOwnInverseProperty(rawNode, 'draftMetadata');
      const draftMetadataValue =
        draftMetadataProperty.kind === 'data' ? draftMetadataProperty.value : undefined;
      const hasDraftMetadata = draftMetadataValue !== undefined && draftMetadataValue !== null;
      let draftMetadata: ValidMetadata | undefined;
      if (hasDraftMetadata) {
        const result = validateMetadata(draftMetadataValue, sourceIndex, nodeId, 'draft');
        if (!result.ok) {
          errors.push(result.error);
          continue;
        }
        draftMetadata = result.value;
      }

      const dataProperty = readOwnInverseProperty(rawNode, 'data');
      const hasDataProperty = dataProperty.kind === 'data';
      const dataValue = dataProperty.kind === 'data' ? dataProperty.value : undefined;
      const hasCommittedPayload = dataValue !== undefined && dataValue !== null;
      const draftDataProperty = readOwnInverseProperty(rawNode, 'draftData');
      const hasDraftDataProperty = draftDataProperty.kind === 'data';
      const draftDataValue =
        draftDataProperty.kind === 'data' ? draftDataProperty.value : undefined;
      const hasDraftData = draftDataValue !== undefined;
      const isEmptyPlainDraftData =
        isPlainInverseRecord(draftDataValue) && Reflect.ownKeys(draftDataValue).length === 0;
      const isTemporaryProperty = readOwnInverseProperty(rawNode, 'isTemporary');
      const isTemporaryPlaceholder =
        isTemporaryProperty.kind === 'data' &&
        isTemporaryProperty.value === true &&
        hasDataProperty &&
        dataValue === null &&
        draftMetadata !== undefined &&
        hasDraftDataProperty &&
        isEmptyPlainDraftData;

      if (isTemporaryPlaceholder) {
        structuralNoops.push(
          freezeValidatedNoop({
            action: 'validated-noop',
            nodeId,
            slot: 'draft',
            reason: 'temporary-placeholder',
          })
        );
        continue;
      }

      let committedValid = false;
      if (hasCommittedPayload) {
        committedValid = validateCanonicalSlot(
          dataValue,
          metadataResult.value.name,
          sourceIndex,
          nodeId,
          'committed',
          slots,
          errors
        );
      }

      if (!hasCommittedPayload) {
        if (draftMetadata !== undefined && hasDraftData && !isEmptyPlainDraftData) {
          validateCanonicalSlot(
            draftDataValue,
            draftMetadata.name,
            sourceIndex,
            nodeId,
            'draft',
            slots,
            errors
          );
        } else {
          errors.push(
            createInverseError(sourceIndex, nodeId, 'node', 'INCOMPLETE_RECORD', {
              field: 'data',
              reason: 'missing',
            })
          );
        }
        continue;
      }

      if (draftMetadata !== undefined && hasDraftData) {
        validateCanonicalSlot(
          draftDataValue,
          draftMetadata.name,
          sourceIndex,
          nodeId,
          'draft',
          slots,
          errors
        );
        continue;
      }
      if (draftMetadata === undefined && hasDraftData) {
        errors.push(
          createInverseError(sourceIndex, nodeId, 'draft', 'DRAFT_DATA_WITHOUT_METADATA', {
            field: 'draftMetadata',
            reason: 'missing',
          })
        );
        continue;
      }
      if (draftMetadata !== undefined && !hasDraftData) {
        if (draftMetadata.name !== metadataResult.value.name) {
          errors.push(
            createInverseError(sourceIndex, nodeId, 'draft', 'METADATA_ONLY_DRAFT_NAME_MISMATCH', {
              field: 'draftMetadata',
              reason: 'name-mismatch',
            })
          );
        } else if (committedValid) {
          structuralNoops.push(
            freezeValidatedNoop({
              action: 'validated-noop',
              nodeId,
              slot: 'draft',
              reason: 'metadata-only-draft',
            })
          );
        }
      }
    } catch {
      errors.push(
        createInverseError(sourceIndex, accessibleNodeId, 'node', 'RAW_RECORD_ACCESS_FAILED', {
          reason: 'reflection-failure',
        })
      );
    }
  }

  for (const [nodeId, sources] of nodeIdSources) {
    if (sources.length < 2) continue;
    for (const sourceIndex of sources) {
      errors.push(
        createInverseError(sourceIndex, nodeId, 'node', 'DUPLICATE_NODE_ID', {
          field: 'id',
          reason: 'duplicate-node-id',
        })
      );
    }
  }

  if (errors.length > 0) {
    sortInverseErrors(errors);
    return { ok: false, errors: freezeInverseErrors(errors) };
  }

  slots.sort(compareNodeSlot);
  structuralNoops.sort(compareNodeSlot);
  nodeGuards.sort((left, right) => compareNodeId(left.nodeId, right.nodeId));
  return {
    ok: true,
    value: Object.freeze({
      slots: Object.freeze(slots),
      nodeGuards: Object.freeze(nodeGuards),
      structuralNoops: Object.freeze(structuralNoops),
    }),
  };
}

export const yamlCoreDbInverseMigrationGuards = Object.freeze({
  compareNodeSlot,
  createFrozenLegacyPayload,
  createInverseError,
  createInverseInputError,
  freezeInverseErrors,
  freezeValidatedNoop,
  inspectYamlCoreDbInverseNodes,
  inverseSlotKey,
  isPlainInverseRecord,
  readOwnInverseProperty,
  readRawInverseSnapshotArray,
  readStrictInverseInputProperties,
  sortInverseErrors,
});
