import {
  createYamlCanonicalPostimageDigest,
  YamlCanonicalPostimageDigestError,
} from '../migration/createYamlCanonicalPostimageDigest.js';
import { yamlCoreDbInverseMigrationGuards } from './yamlCoreDbInverseMigrationGuards.internalConstants.js';
import type {
  PlanExactYamlCoreDbInverseMigrationInput,
  PlanExactYamlCoreDbInverseMigrationResult,
  YamlCoreDbExactInverseMigrationEntry,
  YamlCoreDbExactInverseMigrationJournalGuard,
  YamlCoreDbExactInverseMigrationPlanEntry,
  YamlCoreDbInverseMigrationError,
  YamlCoreDbInverseMigrationSlot,
} from './yamlCoreDbInverseMigrationTypes.js';

const {
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
} = yamlCoreDbInverseMigrationGuards;

const JOURNAL_KEYS = new Set<PropertyKey>([
  'migrationId',
  'fromCoreDbVersion',
  'toCoreDbVersion',
  'nodeId',
  'slot',
  'legacyName',
  'canonicalPostimageDigest',
]);

const EXACT_INPUT_KEYS = [
  'rollbackId',
  'forwardMigrationId',
  'currentCoreDbVersion',
  'rollbackTargetVersion',
  'publicationRequirement',
  'rawNodes',
  'rawJournalEntries',
  'digestSha256Hex',
] as const;

interface ExactInputValues {
  readonly rollbackId: unknown;
  readonly forwardMigrationId: unknown;
  readonly currentCoreDbVersion: unknown;
  readonly rollbackTargetVersion: unknown;
  readonly publicationRequirement: unknown;
  readonly rawNodes: unknown;
  readonly rawJournalEntries: unknown;
  readonly digestSha256Hex: unknown;
}

type JournalField =
  | 'migrationId'
  | 'fromCoreDbVersion'
  | 'toCoreDbVersion'
  | 'nodeId'
  | 'slot'
  | 'legacyName'
  | 'canonicalPostimageDigest';

interface InspectedJournal {
  readonly guards: readonly YamlCoreDbExactInverseMigrationJournalGuard[];
}

type InspectJournalResult =
  | Readonly<{ readonly ok: true; readonly value: InspectedJournal }>
  | Readonly<{ readonly ok: false; readonly errors: readonly YamlCoreDbInverseMigrationError[] }>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validateExactInput(input: ExactInputValues): YamlCoreDbInverseMigrationError[] {
  const errors: YamlCoreDbInverseMigrationError[] = [];
  if (!isNonEmptyString(input.rollbackId)) {
    errors.push(createInverseInputError('INVALID_ROLLBACK_ID', 'rollbackId'));
  }
  if (!isNonEmptyString(input.forwardMigrationId)) {
    errors.push(createInverseInputError('INVALID_FORWARD_MIGRATION_ID', 'forwardMigrationId'));
  }
  const hasValidCurrentVersion = isPositiveSafeInteger(input.currentCoreDbVersion);
  if (!hasValidCurrentVersion) {
    errors.push(createInverseInputError('INVALID_CORE_DB_VERSION', 'currentCoreDbVersion'));
  }
  if (
    !isPositiveSafeInteger(input.rollbackTargetVersion) ||
    (hasValidCurrentVersion && input.rollbackTargetVersion <= input.currentCoreDbVersion)
  ) {
    errors.push(createInverseInputError('INVALID_CORE_DB_VERSION', 'rollbackTargetVersion'));
  }
  if (input.publicationRequirement !== 'canonical-writer-never-published') {
    errors.push(
      createInverseInputError('INVALID_PUBLICATION_REQUIREMENT', 'publicationRequirement')
    );
  }
  if (typeof input.digestSha256Hex !== 'function') {
    errors.push(createInverseInputError('INVALID_DIGEST_PORT', 'digestSha256Hex'));
  }
  return errors;
}

function journalFieldError(
  sourceIndex: number,
  nodeId: string | undefined,
  field: JournalField,
  reason: NonNullable<YamlCoreDbInverseMigrationError['context']>['reason']
): YamlCoreDbInverseMigrationError {
  return createInverseError(sourceIndex, nodeId, 'journal', 'INVALID_JOURNAL_FIELD', {
    field,
    reason,
  });
}

function readJournalDataProperty(
  record: Readonly<Record<PropertyKey, unknown>>,
  field: JournalField,
  sourceIndex: number,
  nodeId: string | undefined,
  errors: YamlCoreDbInverseMigrationError[]
): unknown {
  const property = readOwnInverseProperty(record, field);
  if (property.kind === 'data') return property.value;
  errors.push(
    journalFieldError(
      sourceIndex,
      nodeId,
      field,
      property.kind === 'missing' ? 'missing' : 'accessor-property'
    )
  );
  return undefined;
}

function inspectExactJournal(
  rawJournalEntries: unknown,
  forwardMigrationId: string,
  currentCoreDbVersion: number
): InspectJournalResult {
  const snapshotResult = readRawInverseSnapshotArray(
    rawJournalEntries,
    'rawJournalEntries',
    'INVALID_RAW_JOURNAL'
  );
  if (!snapshotResult.ok) {
    return { ok: false, errors: freezeInverseErrors([snapshotResult.error]) };
  }

  const errors: YamlCoreDbInverseMigrationError[] = [];
  const guards: YamlCoreDbExactInverseMigrationJournalGuard[] = [];
  const compoundKeySources = new Map<string, number[]>();
  let cohort: Readonly<{ readonly from: number; readonly to: number }> | undefined;

  for (let sourceIndex = 0; sourceIndex < snapshotResult.values.length; sourceIndex += 1) {
    const rawJournal = snapshotResult.values[sourceIndex];
    let accessibleNodeId: string | undefined;
    try {
      if (!isPlainInverseRecord(rawJournal)) {
        errors.push(
          createInverseError(sourceIndex, undefined, 'journal', 'INVALID_RAW_JOURNAL_ENTRY', {
            reason: rawJournal === null ? 'null' : 'invalid-type',
          })
        );
        continue;
      }
      const ownKeys = Reflect.ownKeys(rawJournal);
      if (ownKeys.some((key) => readOwnInverseProperty(rawJournal, key).kind !== 'data')) {
        errors.push(
          createInverseError(sourceIndex, undefined, 'journal', 'UNSAFE_PROPERTY_DESCRIPTOR', {
            reason: 'accessor-property',
          })
        );
        continue;
      }
      if (ownKeys.length !== JOURNAL_KEYS.size || ownKeys.some((key) => !JOURNAL_KEYS.has(key))) {
        errors.push(
          createInverseError(sourceIndex, undefined, 'journal', 'INVALID_RAW_JOURNAL_ENTRY', {
            reason: 'unexpected-field',
          })
        );
        continue;
      }

      const entryErrors: YamlCoreDbInverseMigrationError[] = [];
      const migrationId = readJournalDataProperty(
        rawJournal,
        'migrationId',
        sourceIndex,
        undefined,
        entryErrors
      );
      const fromCoreDbVersion = readJournalDataProperty(
        rawJournal,
        'fromCoreDbVersion',
        sourceIndex,
        undefined,
        entryErrors
      );
      const toCoreDbVersion = readJournalDataProperty(
        rawJournal,
        'toCoreDbVersion',
        sourceIndex,
        undefined,
        entryErrors
      );
      const nodeId = readJournalDataProperty(
        rawJournal,
        'nodeId',
        sourceIndex,
        undefined,
        entryErrors
      );
      if (typeof nodeId === 'string' && nodeId.length > 0) accessibleNodeId = nodeId;
      const slot = readJournalDataProperty(
        rawJournal,
        'slot',
        sourceIndex,
        accessibleNodeId,
        entryErrors
      );
      const legacyName = readJournalDataProperty(
        rawJournal,
        'legacyName',
        sourceIndex,
        accessibleNodeId,
        entryErrors
      );
      const canonicalPostimageDigest = readJournalDataProperty(
        rawJournal,
        'canonicalPostimageDigest',
        sourceIndex,
        accessibleNodeId,
        entryErrors
      );
      if (entryErrors.length > 0) {
        errors.push(...entryErrors);
        continue;
      }

      let valid = true;
      if (!isNonEmptyString(migrationId)) {
        errors.push(
          journalFieldError(sourceIndex, accessibleNodeId, 'migrationId', 'invalid-type')
        );
        valid = false;
      } else if (migrationId !== forwardMigrationId) {
        errors.push(
          createInverseError(
            sourceIndex,
            accessibleNodeId,
            'journal',
            'JOURNAL_MIGRATION_ID_MISMATCH',
            { field: 'migrationId', reason: 'migration-id-mismatch' }
          )
        );
        valid = false;
      }
      if (!isPositiveSafeInteger(fromCoreDbVersion)) {
        errors.push(
          journalFieldError(sourceIndex, accessibleNodeId, 'fromCoreDbVersion', 'invalid-type')
        );
        valid = false;
      }
      if (
        !isPositiveSafeInteger(toCoreDbVersion) ||
        (isPositiveSafeInteger(fromCoreDbVersion) && toCoreDbVersion <= fromCoreDbVersion) ||
        toCoreDbVersion > currentCoreDbVersion
      ) {
        errors.push(
          journalFieldError(sourceIndex, accessibleNodeId, 'toCoreDbVersion', 'invalid-type')
        );
        valid = false;
      }
      if (!isNonEmptyString(nodeId)) {
        errors.push(journalFieldError(sourceIndex, undefined, 'nodeId', 'invalid-type'));
        valid = false;
      }
      if (slot !== 'committed' && slot !== 'draft') {
        errors.push(journalFieldError(sourceIndex, accessibleNodeId, 'slot', 'invalid-type'));
        valid = false;
      }
      if (!isNonEmptyString(legacyName)) {
        errors.push(journalFieldError(sourceIndex, accessibleNodeId, 'legacyName', 'invalid-type'));
        valid = false;
      }
      if (
        typeof canonicalPostimageDigest !== 'string' ||
        !/^[0-9a-f]{64}$/.test(canonicalPostimageDigest)
      ) {
        errors.push(
          journalFieldError(
            sourceIndex,
            accessibleNodeId,
            'canonicalPostimageDigest',
            'invalid-type'
          )
        );
        valid = false;
      }
      if (!valid) continue;

      const validFrom = fromCoreDbVersion as number;
      const validTo = toCoreDbVersion as number;
      if (cohort === undefined) {
        cohort = Object.freeze({ from: validFrom, to: validTo });
      } else if (cohort.from !== validFrom || cohort.to !== validTo) {
        errors.push(
          createInverseError(
            sourceIndex,
            nodeId as string,
            'journal',
            'JOURNAL_VERSION_COHORT_MISMATCH',
            { field: 'fromCoreDbVersion', reason: 'version-cohort-mismatch' }
          )
        );
        continue;
      }

      const validSlot = slot as YamlCoreDbInverseMigrationSlot;
      const compoundKey = inverseSlotKey(nodeId as string, validSlot);
      const sources = compoundKeySources.get(compoundKey);
      if (sources === undefined) compoundKeySources.set(compoundKey, [sourceIndex]);
      else sources.push(sourceIndex);
      guards.push(
        Object.freeze({
          sourceIndex,
          migrationId: migrationId as string,
          fromCoreDbVersion: validFrom,
          toCoreDbVersion: validTo,
          nodeId: nodeId as string,
          slot: validSlot,
          legacyName: legacyName as string,
          canonicalPostimageDigest: canonicalPostimageDigest as string,
        })
      );
    } catch {
      errors.push(
        createInverseError(sourceIndex, accessibleNodeId, 'journal', 'INVALID_RAW_JOURNAL_ENTRY', {
          reason: 'reflection-failure',
        })
      );
    }
  }

  for (const [compoundKey, sources] of compoundKeySources) {
    if (sources.length < 2) continue;
    const separatorIndex = compoundKey.lastIndexOf('\u0000');
    const nodeId = compoundKey.slice(0, separatorIndex);
    for (const sourceIndex of sources) {
      errors.push(
        createInverseError(sourceIndex, nodeId, 'journal', 'DUPLICATE_JOURNAL_KEY', {
          field: 'slot',
          reason: 'duplicate-journal-key',
        })
      );
    }
  }

  if (errors.length > 0) {
    sortInverseErrors(errors);
    return { ok: false, errors: freezeInverseErrors(errors) };
  }
  guards.sort(compareNodeSlot);
  return {
    ok: true,
    value: Object.freeze({ guards: Object.freeze(guards) }),
  };
}

/** Plans an exact inverse using only the slots recorded by the forward migration journal. */
export async function planExactYamlCoreDbInverseMigration(
  input: PlanExactYamlCoreDbInverseMigrationInput
): Promise<PlanExactYamlCoreDbInverseMigrationResult> {
  const inputResult = readStrictInverseInputProperties(input, EXACT_INPUT_KEYS);
  if (!inputResult.ok) {
    return Object.freeze({ ok: false, errors: freezeInverseErrors([inputResult.error]) });
  }
  const inputValues: ExactInputValues = {
    rollbackId: inputResult.values.rollbackId,
    forwardMigrationId: inputResult.values.forwardMigrationId,
    currentCoreDbVersion: inputResult.values.currentCoreDbVersion,
    rollbackTargetVersion: inputResult.values.rollbackTargetVersion,
    publicationRequirement: inputResult.values.publicationRequirement,
    rawNodes: inputResult.values.rawNodes,
    rawJournalEntries: inputResult.values.rawJournalEntries,
    digestSha256Hex: inputResult.values.digestSha256Hex,
  };
  const inputErrors = validateExactInput(inputValues);
  if (inputErrors.length > 0) {
    sortInverseErrors(inputErrors);
    return Object.freeze({ ok: false, errors: freezeInverseErrors(inputErrors) });
  }

  const rollbackId = inputValues.rollbackId as string;
  const forwardMigrationId = inputValues.forwardMigrationId as string;
  const currentCoreDbVersion = inputValues.currentCoreDbVersion as number;
  const rollbackTargetVersion = inputValues.rollbackTargetVersion as number;
  const publicationRequirement =
    inputValues.publicationRequirement as 'canonical-writer-never-published';
  const digestSha256Hex = inputValues.digestSha256Hex as (bytes: Uint8Array) => Promise<string>;

  const nodesResult = inspectYamlCoreDbInverseNodes(inputValues.rawNodes);
  const journalResult = inspectExactJournal(
    inputValues.rawJournalEntries,
    forwardMigrationId,
    currentCoreDbVersion
  );
  if (!nodesResult.ok || !journalResult.ok) {
    const errors = [
      ...(nodesResult.ok ? [] : nodesResult.errors),
      ...(journalResult.ok ? [] : journalResult.errors),
    ];
    sortInverseErrors(errors);
    return Object.freeze({ ok: false, errors: freezeInverseErrors(errors) });
  }

  const errors: YamlCoreDbInverseMigrationError[] = [];
  const slotsByKey = new Map(
    nodesResult.value.slots.map((slot) => [inverseSlotKey(slot.nodeId, slot.slot), slot])
  );
  const nodeIds = new Set(nodesResult.value.nodeGuards.map(({ nodeId }) => nodeId));
  for (const guard of journalResult.value.guards) {
    if (!nodeIds.has(guard.nodeId)) {
      errors.push(
        createInverseError(guard.sourceIndex, guard.nodeId, 'journal', 'JOURNAL_NODE_NOT_FOUND', {
          field: 'nodeId',
          reason: 'missing-node',
        })
      );
      continue;
    }
    if (!slotsByKey.has(inverseSlotKey(guard.nodeId, guard.slot))) {
      errors.push(
        createInverseError(guard.sourceIndex, guard.nodeId, 'journal', 'JOURNAL_SLOT_NOT_FOUND', {
          field: 'slot',
          reason: 'missing-slot',
        })
      );
    }
  }
  if (errors.length > 0) {
    sortInverseErrors(errors);
    return Object.freeze({ ok: false, errors: freezeInverseErrors(errors) });
  }

  const entries: YamlCoreDbExactInverseMigrationPlanEntry[] = [
    ...nodesResult.value.structuralNoops,
  ];
  const guardsByKey = new Map(
    journalResult.value.guards.map((guard) => [inverseSlotKey(guard.nodeId, guard.slot), guard])
  );
  for (const slot of nodesResult.value.slots) {
    const guard = guardsByKey.get(inverseSlotKey(slot.nodeId, slot.slot));
    if (guard === undefined) {
      entries.push(
        freezeValidatedNoop({
          action: 'validated-noop',
          nodeId: slot.nodeId,
          slot: slot.slot,
          reason: 'non-journal-canonical',
        })
      );
      continue;
    }

    if (guard.legacyName !== slot.filename) {
      errors.push(
        createInverseError(
          slot.sourceIndex,
          slot.nodeId,
          slot.slot,
          'JOURNAL_LEGACY_NAME_MISMATCH',
          { field: 'legacyName', reason: 'name-mismatch' }
        )
      );
      continue;
    }

    let digest: string;
    try {
      digest = await createYamlCanonicalPostimageDigest(
        slot.filename,
        slot.payload,
        digestSha256Hex
      );
    } catch (error) {
      const code =
        error instanceof YamlCanonicalPostimageDigestError ? error.code : 'DIGEST_PORT_FAILED';
      errors.push(
        createInverseError(slot.sourceIndex, slot.nodeId, slot.slot, code, {
          field: 'canonicalPostimageDigest',
          reason: code === 'INVALID_DIGEST_OUTPUT' ? 'invalid-hash-output' : 'hash-failure',
        })
      );
      continue;
    }
    if (digest !== guard.canonicalPostimageDigest) {
      errors.push(
        createInverseError(slot.sourceIndex, slot.nodeId, slot.slot, 'JOURNAL_DIGEST_MISMATCH', {
          field: 'canonicalPostimageDigest',
          reason: 'digest-mismatch',
        })
      );
      continue;
    }
    const entry: YamlCoreDbExactInverseMigrationEntry = Object.freeze({
      action: 'restore-exact-legacy',
      nodeId: slot.nodeId,
      slot: slot.slot,
      preimage: slot.payload,
      postimage: createFrozenLegacyPayload(guard.legacyName, slot.payload),
      expectedCanonicalPostimageDigest: guard.canonicalPostimageDigest,
    });
    entries.push(entry);
  }

  if (errors.length > 0) {
    sortInverseErrors(errors);
    return Object.freeze({ ok: false, errors: freezeInverseErrors(errors) });
  }
  entries.sort(compareNodeSlot);
  const plan = Object.freeze({
    rollbackId,
    forwardMigrationId,
    currentCoreDbVersion,
    rollbackTargetVersion,
    publicationRequirement,
    nodeGuards: nodesResult.value.nodeGuards,
    journalGuards: journalResult.value.guards,
    entries: Object.freeze(entries),
  });
  return Object.freeze({ ok: true, plan });
}
