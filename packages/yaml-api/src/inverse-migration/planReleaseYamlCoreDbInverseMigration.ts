import { yamlCoreDbInverseMigrationGuards } from './yamlCoreDbInverseMigrationGuards.internalConstants.js';
import type {
  PlanReleaseYamlCoreDbInverseMigrationInput,
  PlanReleaseYamlCoreDbInverseMigrationResult,
  YamlCoreDbInverseMigrationError,
  YamlCoreDbReleaseInverseMigrationEntry,
  YamlCoreDbReleaseInverseMigrationPlanEntry,
} from './yamlCoreDbInverseMigrationTypes.js';

const {
  compareNodeSlot,
  createFrozenLegacyPayload,
  createInverseInputError,
  freezeInverseErrors,
  inspectYamlCoreDbInverseNodes,
  readStrictInverseInputProperties,
  sortInverseErrors,
} = yamlCoreDbInverseMigrationGuards;

const RELEASE_INPUT_KEYS = [
  'rollbackId',
  'currentCoreDbVersion',
  'rollbackTargetVersion',
  'publicationRequirement',
  'rawNodes',
] as const;

interface ReleaseInputValues {
  readonly rollbackId: unknown;
  readonly currentCoreDbVersion: unknown;
  readonly rollbackTargetVersion: unknown;
  readonly publicationRequirement: unknown;
  readonly rawNodes: unknown;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validateReleaseInput(input: ReleaseInputValues): YamlCoreDbInverseMigrationError[] {
  const errors: YamlCoreDbInverseMigrationError[] = [];
  if (!isNonBlankString(input.rollbackId)) {
    errors.push(createInverseInputError('INVALID_ROLLBACK_ID', 'rollbackId'));
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
  if (input.publicationRequirement !== 'canonical-writer-published-or-unknown') {
    errors.push(
      createInverseInputError('INVALID_PUBLICATION_REQUIREMENT', 'publicationRequirement')
    );
  }
  return errors;
}

/** Plans a release inverse for every present, strictly canonical YAML payload slot. */
export function planReleaseYamlCoreDbInverseMigration(
  input: PlanReleaseYamlCoreDbInverseMigrationInput
): PlanReleaseYamlCoreDbInverseMigrationResult {
  const inputResult = readStrictInverseInputProperties(input, RELEASE_INPUT_KEYS);
  if (!inputResult.ok) {
    return Object.freeze({ ok: false, errors: freezeInverseErrors([inputResult.error]) });
  }
  const inputValues: ReleaseInputValues = {
    rollbackId: inputResult.values.rollbackId,
    currentCoreDbVersion: inputResult.values.currentCoreDbVersion,
    rollbackTargetVersion: inputResult.values.rollbackTargetVersion,
    publicationRequirement: inputResult.values.publicationRequirement,
    rawNodes: inputResult.values.rawNodes,
  };
  const inputErrors = validateReleaseInput(inputValues);
  if (inputErrors.length > 0) {
    sortInverseErrors(inputErrors);
    return Object.freeze({ ok: false, errors: freezeInverseErrors(inputErrors) });
  }

  const rollbackId = inputValues.rollbackId as string;
  const currentCoreDbVersion = inputValues.currentCoreDbVersion as number;
  const rollbackTargetVersion = inputValues.rollbackTargetVersion as number;
  const publicationRequirement =
    inputValues.publicationRequirement as 'canonical-writer-published-or-unknown';

  const nodesResult = inspectYamlCoreDbInverseNodes(inputValues.rawNodes);
  if (!nodesResult.ok) {
    return Object.freeze({ ok: false, errors: nodesResult.errors });
  }

  const entries: YamlCoreDbReleaseInverseMigrationPlanEntry[] = [
    ...nodesResult.value.structuralNoops,
  ];
  for (const slot of nodesResult.value.slots) {
    const entry: YamlCoreDbReleaseInverseMigrationEntry = Object.freeze({
      action: 'restore-release-legacy',
      nodeId: slot.nodeId,
      slot: slot.slot,
      preimage: slot.payload,
      postimage: createFrozenLegacyPayload(slot.filename, slot.payload),
    });
    entries.push(entry);
  }
  entries.sort(compareNodeSlot);
  const plan = Object.freeze({
    rollbackId,
    currentCoreDbVersion,
    rollbackTargetVersion,
    publicationRequirement,
    nodeGuards: nodesResult.value.nodeGuards,
    entries: Object.freeze(entries),
  });
  return Object.freeze({ ok: true, plan });
}
