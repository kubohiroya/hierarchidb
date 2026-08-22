import {
  createYamlCanonicalPostimageDigest,
  YamlCanonicalPostimageDigestError,
} from './createYamlCanonicalPostimageDigest.js';
import {
  isPlainMigrationRecord,
  readOwnMigrationProperty,
  validateYamlCoreDbMigrationSlot,
} from './validateYamlCoreDbMigrationSlot.js';
import type {
  YamlCanonicalMigrationPayload,
  YamlCoreDbHostSplitLegacyMigrateEntry,
  YamlCoreDbLegacyWithNameMigrateEntry,
  YamlCoreDbMigrateEntry,
  YamlCoreDbMigrationError,
  YamlCoreDbMigrationInput,
  YamlCoreDbMigrationJournalValue,
  YamlCoreDbMigrationNodeGuard,
  YamlCoreDbMigrationPlanEntry,
  YamlCoreDbMigrationResult,
  YamlCoreDbMigrationSlot,
  YamlCoreDbValidatedNoopEntry,
  YamlHostSplitLegacyMigrationPayload,
  YamlLegacyMigrationPayload,
} from './yamlCoreDbMigrationTypes.js';

interface PendingMigrationEntryBase {
  readonly action: 'migrate';
  readonly sourceIndex: number;
  readonly nodeId: string;
  readonly slot: YamlCoreDbMigrationSlot;
  readonly filename: string;
  readonly legacyName: string;
  readonly postimage: YamlCanonicalMigrationPayload;
}

interface PendingLegacyWithNameMigrationEntry extends PendingMigrationEntryBase {
  readonly preimageRepresentation: 'legacy-with-name';
  readonly preimage: YamlLegacyMigrationPayload;
}

interface PendingHostSplitLegacyMigrationEntry extends PendingMigrationEntryBase {
  readonly preimageRepresentation: 'host-split-legacy';
  readonly preimage: YamlHostSplitLegacyMigrationPayload;
}

type PendingMigrationEntry =
  | PendingLegacyWithNameMigrationEntry
  | PendingHostSplitLegacyMigrationEntry;

type PendingPlanEntry = PendingMigrationEntry | YamlCoreDbValidatedNoopEntry;

interface ValidMetadata {
  readonly name: string;
}

const SLOT_ORDER: Readonly<Record<YamlCoreDbMigrationSlot, number>> = {
  committed: 0,
  draft: 1,
};

function createInputError(
  code: YamlCoreDbMigrationError['code'],
  field: NonNullable<YamlCoreDbMigrationError['context']>['field']
): YamlCoreDbMigrationError {
  return {
    sourceIndex: -1,
    slot: 'input',
    code,
    context: { field, reason: 'invalid-type' },
  };
}

function createNodeError(
  sourceIndex: number,
  nodeId: string | undefined,
  slot: YamlCoreDbMigrationError['slot'],
  code: YamlCoreDbMigrationError['code'],
  context?: YamlCoreDbMigrationError['context']
): YamlCoreDbMigrationError {
  const common = { sourceIndex, slot, code };
  if (nodeId === undefined && context === undefined) {
    return common;
  }
  if (nodeId === undefined) {
    return { ...common, context };
  }
  if (context === undefined) {
    return { ...common, nodeId };
  }
  return { ...common, nodeId, context };
}

function validateMetadata(
  value: unknown,
  sourceIndex: number,
  nodeId: string,
  slot: 'node' | 'draft'
):
  | Readonly<{ readonly ok: true; readonly value: ValidMetadata }>
  | Readonly<{ readonly ok: false; readonly error: YamlCoreDbMigrationError }> {
  const isDraft = slot === 'draft';
  if (!isPlainMigrationRecord(value)) {
    return {
      ok: false,
      error: createNodeError(
        sourceIndex,
        nodeId,
        slot,
        isDraft ? 'INVALID_DRAFT_METADATA' : 'INVALID_METADATA',
        {
          field: isDraft ? 'draftMetadata' : 'metadata',
          reason: value === null ? 'null' : 'invalid-type',
        }
      ),
    };
  }
  if (Reflect.ownKeys(value).some((key) => readOwnMigrationProperty(value, key).kind !== 'data')) {
    return {
      ok: false,
      error: createNodeError(sourceIndex, nodeId, slot, 'UNSAFE_PROPERTY_DESCRIPTOR', {
        field: isDraft ? 'draftMetadata' : 'metadata',
        reason: 'accessor-property',
      }),
    };
  }
  const nameProperty = readOwnMigrationProperty(value, 'name');
  if (nameProperty.kind === 'missing') {
    return {
      ok: false,
      error: createNodeError(
        sourceIndex,
        nodeId,
        slot,
        isDraft ? 'INVALID_DRAFT_METADATA_NAME' : 'INVALID_METADATA_NAME',
        {
          field: isDraft ? 'draftMetadata' : 'metadata',
          reason: 'missing',
        }
      ),
    };
  }
  if (nameProperty.kind === 'accessor') {
    return {
      ok: false,
      error: createNodeError(sourceIndex, nodeId, slot, 'UNSAFE_PROPERTY_DESCRIPTOR', {
        field: isDraft ? 'draftMetadata' : 'metadata',
        reason: 'accessor-property',
      }),
    };
  }
  const name = nameProperty.value;
  if (typeof name !== 'string' || name.length === 0) {
    return {
      ok: false,
      error: createNodeError(
        sourceIndex,
        nodeId,
        slot,
        isDraft ? 'INVALID_DRAFT_METADATA_NAME' : 'INVALID_METADATA_NAME',
        {
          field: isDraft ? 'draftMetadata' : 'metadata',
          reason: name === '' ? 'empty' : 'invalid-type',
        }
      ),
    };
  }
  return { ok: true, value: { name } };
}

function compareNodeId(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortPendingEntries(entries: PendingPlanEntry[]): void {
  entries.sort((left, right) => {
    const nodeComparison = compareNodeId(left.nodeId, right.nodeId);
    return nodeComparison === 0 ? SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot] : nodeComparison;
  });
}

function sortErrors(errors: YamlCoreDbMigrationError[]): void {
  const errorSlotOrder: Readonly<Record<YamlCoreDbMigrationError['slot'], number>> = {
    input: -2,
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

function addValidatedSlot(
  pendingEntries: PendingPlanEntry[],
  errors: YamlCoreDbMigrationError[],
  payload: unknown,
  metadataName: string,
  sourceIndex: number,
  nodeId: string,
  slot: YamlCoreDbMigrationSlot
): boolean {
  const result = validateYamlCoreDbMigrationSlot(payload, metadataName, sourceIndex, nodeId, slot);
  if (!result.ok) {
    errors.push(result.error);
    return false;
  }
  if (result.value.classification === 'canonical') {
    pendingEntries.push({
      action: 'validated-noop',
      nodeId,
      slot,
      reason: 'canonical',
    });
    return true;
  }
  if (result.value.classification === 'host-split-legacy') {
    pendingEntries.push({
      action: 'migrate',
      sourceIndex,
      nodeId,
      slot,
      filename: metadataName,
      preimageRepresentation: 'host-split-legacy',
      preimage: result.value.preimage,
      legacyName: result.value.legacyName,
      postimage: result.value.postimage,
    });
    return true;
  }
  pendingEntries.push({
    action: 'migrate',
    sourceIndex,
    nodeId,
    slot,
    filename: metadataName,
    preimageRepresentation: 'legacy-with-name',
    preimage: result.value.preimage,
    legacyName: result.value.preimage.name,
    postimage: result.value.postimage,
  });
  return true;
}

function validateInput(input: YamlCoreDbMigrationInput): YamlCoreDbMigrationError[] {
  const errors: YamlCoreDbMigrationError[] = [];
  if (typeof input.migrationId !== 'string' || input.migrationId.length === 0) {
    errors.push(createInputError('INVALID_MIGRATION_ID', 'migrationId'));
  }
  if (!Number.isSafeInteger(input.fromCoreDbVersion) || input.fromCoreDbVersion <= 0) {
    errors.push(createInputError('INVALID_CORE_DB_VERSION', 'fromCoreDbVersion'));
  }
  if (
    !Number.isSafeInteger(input.toCoreDbVersion) ||
    input.toCoreDbVersion <= 0 ||
    input.toCoreDbVersion <= input.fromCoreDbVersion
  ) {
    errors.push(createInputError('INVALID_CORE_DB_VERSION', 'toCoreDbVersion'));
  }
  if (!Array.isArray(input.rawNodes)) {
    errors.push(createInputError('INVALID_RAW_NODES', 'rawNodes'));
  }
  if (typeof input.digestSha256Hex !== 'function') {
    errors.push(createInputError('INVALID_DIGEST_PORT', 'digestSha256Hex'));
  }
  return errors;
}

/** Plans a strict, deterministic, read-only CoreDB YAML payload migration. */
export async function planYamlCoreDbMigration(
  input: YamlCoreDbMigrationInput
): Promise<YamlCoreDbMigrationResult> {
  const errors = validateInput(input);
  if (errors.length > 0) {
    sortErrors(errors);
    return { ok: false, errors };
  }

  const pendingEntries: PendingPlanEntry[] = [];
  const nodeGuards: YamlCoreDbMigrationNodeGuard[] = [];
  const nodeIdSources = new Map<string, number[]>();

  for (let sourceIndex = 0; sourceIndex < input.rawNodes.length; sourceIndex += 1) {
    let rawNode: unknown;
    try {
      const rawNodeDescriptor = Object.getOwnPropertyDescriptor(
        input.rawNodes,
        String(sourceIndex)
      );
      if (rawNodeDescriptor !== undefined && !Object.hasOwn(rawNodeDescriptor, 'value')) {
        errors.push(
          createNodeError(sourceIndex, undefined, 'node', 'UNSAFE_PROPERTY_DESCRIPTOR', {
            reason: 'accessor-property',
          })
        );
        continue;
      }
      rawNode = rawNodeDescriptor?.value;
    } catch {
      errors.push(
        createNodeError(sourceIndex, undefined, 'node', 'RAW_RECORD_ACCESS_FAILED', {
          reason: 'record-access-failure',
        })
      );
      continue;
    }
    let accessibleNodeId: string | undefined;
    try {
      if (!isPlainMigrationRecord(rawNode)) {
        errors.push(
          createNodeError(sourceIndex, undefined, 'node', 'INVALID_RAW_NODE', {
            reason: rawNode === null ? 'null' : 'invalid-type',
          })
        );
        continue;
      }

      const nodeIdProperty = readOwnMigrationProperty(rawNode, 'id');
      if (nodeIdProperty.kind === 'accessor') {
        errors.push(
          createNodeError(sourceIndex, undefined, 'node', 'UNSAFE_PROPERTY_DESCRIPTOR', {
            field: 'id',
            reason: 'accessor-property',
          })
        );
        continue;
      }
      const rawNodeId = nodeIdProperty.kind === 'data' ? nodeIdProperty.value : undefined;
      const nodeId = typeof rawNodeId === 'string' && rawNodeId.length > 0 ? rawNodeId : undefined;
      if (nodeId === undefined) {
        errors.push(
          createNodeError(sourceIndex, undefined, 'node', 'INVALID_NODE_ID', {
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

      if (
        Reflect.ownKeys(rawNode).some(
          (key) => readOwnMigrationProperty(rawNode, key).kind !== 'data'
        )
      ) {
        errors.push(
          createNodeError(sourceIndex, nodeId, 'node', 'UNSAFE_PROPERTY_DESCRIPTOR', {
            reason: 'accessor-property',
          })
        );
        continue;
      }

      const sources = nodeIdSources.get(nodeId);
      if (sources === undefined) {
        nodeIdSources.set(nodeId, [sourceIndex]);
      } else {
        sources.push(sourceIndex);
      }

      const versionProperty = readOwnMigrationProperty(rawNode, 'version');
      const version = versionProperty.kind === 'data' ? versionProperty.value : undefined;
      if (!Number.isSafeInteger(version) || typeof version !== 'number' || version < 0) {
        errors.push(
          createNodeError(sourceIndex, nodeId, 'node', 'INVALID_NODE_VERSION', {
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

      nodeGuards.push({ sourceIndex, nodeId, expectedVersion: version });

      const nodeTypeProperty = readOwnMigrationProperty(rawNode, 'nodeType');
      if (nodeTypeProperty.kind !== 'data' || nodeTypeProperty.value !== 'yaml-file') {
        errors.push(
          createNodeError(sourceIndex, nodeId, 'node', 'INVALID_NODE_TYPE', {
            field: 'nodeType',
            reason: nodeTypeProperty.kind === 'missing' ? 'missing' : 'invalid-type',
          })
        );
        continue;
      }

      const metadataProperty = readOwnMigrationProperty(rawNode, 'metadata');
      const metadataValue = metadataProperty.kind === 'data' ? metadataProperty.value : undefined;
      const metadataResult = validateMetadata(metadataValue, sourceIndex, nodeId, 'node');
      if (!metadataResult.ok) {
        errors.push(metadataResult.error);
        continue;
      }

      const dataProperty = readOwnMigrationProperty(rawNode, 'data');
      const hasDataProperty = dataProperty.kind === 'data';
      const dataValue = dataProperty.kind === 'data' ? dataProperty.value : undefined;
      const hasCommittedPayload = dataValue !== undefined && dataValue !== null;

      const draftMetadataProperty = readOwnMigrationProperty(rawNode, 'draftMetadata');
      const draftMetadataValue =
        draftMetadataProperty.kind === 'data' ? draftMetadataProperty.value : undefined;
      const hasDraftMetadata = draftMetadataValue !== undefined && draftMetadataValue !== null;
      let draftMetadata: ValidMetadata | undefined;
      if (hasDraftMetadata) {
        const draftMetadataResult = validateMetadata(
          draftMetadataValue,
          sourceIndex,
          nodeId,
          'draft'
        );
        if (!draftMetadataResult.ok) {
          errors.push(draftMetadataResult.error);
          continue;
        }
        draftMetadata = draftMetadataResult.value;
      }

      const draftDataProperty = readOwnMigrationProperty(rawNode, 'draftData');
      const hasDraftDataProperty = draftDataProperty.kind === 'data';
      const draftDataValue =
        draftDataProperty.kind === 'data' ? draftDataProperty.value : undefined;
      const hasDraftData = draftDataValue !== undefined && draftDataValue !== null;
      const isEmptyPlainDraftData =
        isPlainMigrationRecord(draftDataValue) && Reflect.ownKeys(draftDataValue).length === 0;
      const isTemporaryProperty = readOwnMigrationProperty(rawNode, 'isTemporary');
      const isTemporaryPlaceholder =
        isTemporaryProperty.kind === 'data' &&
        isTemporaryProperty.value === true &&
        hasDataProperty &&
        dataValue === null &&
        draftMetadata !== undefined &&
        hasDraftDataProperty &&
        isEmptyPlainDraftData;

      if (isTemporaryPlaceholder) {
        pendingEntries.push({
          action: 'validated-noop',
          nodeId,
          slot: 'draft',
          reason: 'temporary-placeholder',
        });
        continue;
      }

      let committedValid = false;
      if (hasCommittedPayload) {
        committedValid = addValidatedSlot(
          pendingEntries,
          errors,
          dataValue,
          metadataResult.value.name,
          sourceIndex,
          nodeId,
          'committed'
        );
      }

      if (!hasCommittedPayload) {
        if (draftMetadata !== undefined && hasDraftData && !isEmptyPlainDraftData) {
          addValidatedSlot(
            pendingEntries,
            errors,
            draftDataValue,
            draftMetadata.name,
            sourceIndex,
            nodeId,
            'draft'
          );
        } else {
          errors.push(
            createNodeError(sourceIndex, nodeId, 'node', 'INCOMPLETE_RECORD', {
              field: 'data',
              reason: 'missing',
            })
          );
        }
        continue;
      }

      if (draftMetadata !== undefined && hasDraftData) {
        addValidatedSlot(
          pendingEntries,
          errors,
          draftDataValue,
          draftMetadata.name,
          sourceIndex,
          nodeId,
          'draft'
        );
        continue;
      }
      if (draftMetadata === undefined && hasDraftData) {
        errors.push(
          createNodeError(sourceIndex, nodeId, 'draft', 'DRAFT_DATA_WITHOUT_METADATA', {
            field: 'draftMetadata',
            reason: 'missing',
          })
        );
        continue;
      }
      if (draftMetadata !== undefined && !hasDraftData) {
        if (draftMetadata.name !== metadataResult.value.name) {
          errors.push(
            createNodeError(sourceIndex, nodeId, 'draft', 'METADATA_ONLY_DRAFT_NAME_MISMATCH', {
              field: 'draftMetadata',
              reason: 'name-mismatch',
            })
          );
        } else if (committedValid) {
          pendingEntries.push({
            action: 'validated-noop',
            nodeId,
            slot: 'draft',
            reason: 'metadata-only-draft',
          });
        }
      }
    } catch {
      errors.push(
        createNodeError(sourceIndex, accessibleNodeId, 'node', 'RAW_RECORD_ACCESS_FAILED', {
          reason: 'record-access-failure',
        })
      );
    }
  }

  for (const [nodeId, sources] of nodeIdSources) {
    if (sources.length > 1) {
      for (const sourceIndex of sources) {
        errors.push(
          createNodeError(sourceIndex, nodeId, 'node', 'DUPLICATE_NODE_ID', {
            field: 'id',
            reason: 'duplicate-node-id',
          })
        );
      }
    }
  }

  if (errors.length > 0) {
    sortErrors(errors);
    return { ok: false, errors };
  }

  sortPendingEntries(pendingEntries);
  nodeGuards.sort((left, right) => compareNodeId(left.nodeId, right.nodeId));
  const entries: YamlCoreDbMigrationPlanEntry[] = [];
  for (const pendingEntry of pendingEntries) {
    if (pendingEntry.action === 'validated-noop') {
      entries.push(pendingEntry);
      continue;
    }
    try {
      const canonicalPostimageDigest = await createYamlCanonicalPostimageDigest(
        pendingEntry.filename,
        pendingEntry.postimage,
        input.digestSha256Hex
      );
      const journalValue: YamlCoreDbMigrationJournalValue = {
        migrationId: input.migrationId,
        fromCoreDbVersion: input.fromCoreDbVersion,
        toCoreDbVersion: input.toCoreDbVersion,
        nodeId: pendingEntry.nodeId,
        slot: pendingEntry.slot,
        preimageRepresentation: pendingEntry.preimageRepresentation,
        legacyName: pendingEntry.legacyName,
        canonicalPostimageDigest,
      };
      const commonEntry = {
        action: 'migrate' as const,
        nodeId: pendingEntry.nodeId,
        slot: pendingEntry.slot,
        postimage: pendingEntry.postimage,
        legacyName: pendingEntry.legacyName,
        canonicalPostimageDigest,
        journalValue,
      };
      let migratedEntry: YamlCoreDbMigrateEntry;
      if (pendingEntry.preimageRepresentation === 'legacy-with-name') {
        const legacyWithNameEntry: YamlCoreDbLegacyWithNameMigrateEntry = {
          ...commonEntry,
          preimageRepresentation: pendingEntry.preimageRepresentation,
          preimage: pendingEntry.preimage,
        };
        migratedEntry = legacyWithNameEntry;
      } else {
        const hostSplitLegacyEntry: YamlCoreDbHostSplitLegacyMigrateEntry = {
          ...commonEntry,
          preimageRepresentation: pendingEntry.preimageRepresentation,
          preimage: pendingEntry.preimage,
        };
        migratedEntry = hostSplitLegacyEntry;
      }
      entries.push(migratedEntry);
    } catch (error) {
      const code =
        error instanceof YamlCanonicalPostimageDigestError ? error.code : 'DIGEST_PORT_FAILED';
      errors.push(
        createNodeError(pendingEntry.sourceIndex, pendingEntry.nodeId, pendingEntry.slot, code, {
          reason: code === 'INVALID_DIGEST_OUTPUT' ? 'invalid-hash-output' : 'hash-failure',
        })
      );
    }
  }

  if (errors.length > 0) {
    sortErrors(errors);
    return { ok: false, errors };
  }

  return {
    ok: true,
    plan: {
      migrationId: input.migrationId,
      fromCoreDbVersion: input.fromCoreDbVersion,
      toCoreDbVersion: input.toCoreDbVersion,
      nodeGuards,
      entries,
    },
  };
}
