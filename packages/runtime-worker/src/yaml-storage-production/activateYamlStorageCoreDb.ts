import {
  planYamlCoreDbMigration,
  type YamlCoreDbMigrationPlan,
} from '@hierarchidb/yaml-api/migration';
import { YAML_MIGRATION_JOURNAL_STORE_NAME } from '../services/CoreDB.js';
import {
  createYamlStorageFreshActivation,
  reduceYamlStorageActivation,
} from '../yaml-storage-activation/index.js';
import { isIssuedYamlStorageActivationState } from '../yaml-storage-activation/yamlStorageActivationProvenanceUtils.js';
import type { YamlStorageActivationState } from '../yaml-storage-activation/yamlStorageActivationTypes.js';
import { validateCanonicalYamlStorageCoreDb } from './validateCanonicalYamlStorageCoreDb.js';
import {
  createCoreDbV2Schema,
  openCoreDbAtExactVersion,
  openExistingCoreDb,
  readAllCoreDbNodes,
  validateCoreDbV1Schema,
  yamlStorageCoreDbSchema,
} from './yamlStorageCoreDbSchemaUtils.js';
import type {
  ActivateYamlStorageCoreDbInput,
  ActivateYamlStorageCoreDbResult,
  YamlStorageCoreDbError,
  YamlStorageCoreDbErrorCode,
} from './yamlStorageCoreDbTypes.js';
import {
  CORE_DB_CANONICAL_LOGICAL_VERSION,
  CORE_DB_CANONICAL_NATIVE_VERSION,
  CORE_DB_LEGACY_LOGICAL_VERSION,
  CORE_DB_LEGACY_NATIVE_VERSION,
} from './yamlStorageCoreDbVersionConstants.js';
import {
  cloneYamlStorageRawNode,
  selectYamlStorageRawNodes,
  yamlStorageRawSnapshotsMatch,
} from './yamlStorageRawSnapshotUtils.js';

type UpgradeResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly code: YamlStorageCoreDbErrorCode }>;

function freezeError(
  code: YamlStorageCoreDbErrorCode,
  planningErrors?: YamlStorageCoreDbError['planningErrors']
): YamlStorageCoreDbError {
  return Object.freeze({ code, ...(planningErrors === undefined ? {} : { planningErrors }) });
}

function rejectActivationState(state: YamlStorageActivationState): YamlStorageActivationState {
  if (state.phase === 'rejected' || state.phase === 'canonical-ready') return state;
  if (state.phase === 'quiescing' || state.phase === 'preflight') {
    return reduceYamlStorageActivation(state, {
      type: 'activation-rejected',
      activationId: state.activationId,
      stage: state.phase,
    });
  }
  return reduceYamlStorageActivation(state, {
    type: 'activation-rejected',
    activationId: state.activationId,
    openRequestId: state.openRequestId,
    stage: state.phase,
  });
}

function failedResult(
  state: YamlStorageActivationState,
  code: YamlStorageCoreDbErrorCode,
  planningErrors?: YamlStorageCoreDbError['planningErrors']
): ActivateYamlStorageCoreDbResult {
  return Object.freeze({
    ok: false,
    state: rejectActivationState(state),
    error: freezeError(code, planningErrors),
  });
}

function isValidInput(input: ActivateYamlStorageCoreDbInput): boolean {
  return (
    isIssuedYamlStorageActivationState(input.state) &&
    input.state.phase === 'preflight' &&
    input.state.currentVersion === CORE_DB_LEGACY_LOGICAL_VERSION &&
    input.state.targetVersion === CORE_DB_CANONICAL_LOGICAL_VERSION &&
    typeof input.databaseName === 'string' &&
    input.databaseName.length > 0 &&
    typeof input.migrationId === 'string' &&
    input.migrationId.length > 0 &&
    typeof input.openRequestId === 'string' &&
    input.openRequestId.length > 0 &&
    typeof input.environment.digestSha256Hex === 'function' &&
    typeof input.environment.initializeCoreDb === 'function'
  );
}

function applyMigrationPlan(
  nodesStore: IDBObjectStore,
  journalStore: IDBObjectStore,
  versionchangeNodes: readonly unknown[],
  plan: YamlCoreDbMigrationPlan
): boolean {
  const nodesById = new Map<string, unknown>();
  for (const rawNode of versionchangeNodes) {
    if (rawNode === null || typeof rawNode !== 'object') return false;
    const idDescriptor = Object.getOwnPropertyDescriptor(rawNode, 'id');
    if (
      idDescriptor === undefined ||
      !Object.hasOwn(idDescriptor, 'value') ||
      typeof idDescriptor.value !== 'string' ||
      nodesById.has(idDescriptor.value)
    ) {
      return false;
    }
    nodesById.set(idDescriptor.value, rawNode);
  }

  const changedNodes = new Map<string, Record<PropertyKey, unknown>>();
  for (const entry of plan.entries) {
    if (entry.action === 'validated-noop') continue;
    let changedNode = changedNodes.get(entry.nodeId);
    if (changedNode === undefined) {
      const clone = cloneYamlStorageRawNode(nodesById.get(entry.nodeId));
      if (clone === null) return false;
      changedNode = clone;
      changedNodes.set(entry.nodeId, changedNode);
    }
    Object.defineProperty(changedNode, entry.slot === 'committed' ? 'data' : 'draftData', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: entry.postimage,
    });
    journalStore.add(entry.journalValue);
  }
  for (const changedNode of changedNodes.values()) nodesStore.put(changedNode);
  return true;
}

function openAndUpgradeCoreDb(
  input: ActivateYamlStorageCoreDbInput,
  initialState: YamlStorageActivationState,
  preflightNodes: readonly unknown[],
  plan: YamlCoreDbMigrationPlan,
  onState: (state: YamlStorageActivationState) => void
): Promise<UpgradeResult> {
  return new Promise((resolve) => {
    let settled = false;
    let upgradeStarted = false;
    let snapshotMismatch = false;
    let currentState = initialState;
    const finish = (result: UpgradeResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let request: IDBOpenDBRequest;
    try {
      request = input.environment.indexedDB.open(
        input.databaseName,
        CORE_DB_CANONICAL_NATIVE_VERSION
      );
    } catch {
      finish(Object.freeze({ ok: false, code: 'MIGRATION_TARGET_OPEN_FAILED' }));
      return;
    }
    request.onblocked = () => {
      if (currentState.phase !== 'opening-target') return;
      const nextState = reduceYamlStorageActivation(currentState, {
        type: 'target-open-blocked',
        activationId: currentState.activationId,
        openRequestId: input.openRequestId,
      });
      currentState = nextState;
      onState(nextState);
    };
    request.onerror = () =>
      finish(
        Object.freeze({
          ok: false,
          code: snapshotMismatch ? 'MIGRATION_SNAPSHOT_MISMATCH' : 'MIGRATION_UPGRADE_FAILED',
        })
      );
    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (
        transaction === null ||
        event.oldVersion !== CORE_DB_LEGACY_NATIVE_VERSION ||
        event.newVersion !== CORE_DB_CANONICAL_NATIVE_VERSION
      ) {
        transaction?.abort();
        return;
      }
      upgradeStarted = true;
      const nextState = reduceYamlStorageActivation(currentState, {
        type: 'versionchange-started',
        activationId: currentState.activationId,
        openRequestId: input.openRequestId,
      });
      currentState = nextState;
      onState(nextState);
      try {
        const journalStore = request.result.createObjectStore(YAML_MIGRATION_JOURNAL_STORE_NAME, {
          keyPath: [...yamlStorageCoreDbSchema.journalPrimaryKey],
        });
        journalStore.createIndex(yamlStorageCoreDbSchema.journalCohortIndexName, [
          ...yamlStorageCoreDbSchema.journalCohortIndexKeyPath,
        ]);
        const nodesStore = transaction.objectStore('nodes');
        const snapshotRequest = nodesStore.getAll();
        snapshotRequest.onerror = () => transaction.abort();
        snapshotRequest.onsuccess = () => {
          let selected: ReturnType<typeof selectYamlStorageRawNodes>;
          try {
            selected = selectYamlStorageRawNodes(snapshotRequest.result);
          } catch {
            snapshotMismatch = true;
            transaction.abort();
            return;
          }
          if (
            !selected.ok ||
            !yamlStorageRawSnapshotsMatch(preflightNodes, selected.rawYamlNodes)
          ) {
            snapshotMismatch = true;
            transaction.abort();
            return;
          }
          try {
            if (!applyMigrationPlan(nodesStore, journalStore, selected.rawYamlNodes, plan)) {
              snapshotMismatch = true;
              transaction.abort();
            }
          } catch {
            transaction.abort();
          }
        };
      } catch {
        transaction.abort();
      }
    };
    request.onsuccess = () => {
      request.result.close();
      if (!upgradeStarted) {
        finish(Object.freeze({ ok: false, code: 'MIGRATION_TARGET_OPEN_FAILED' }));
        return;
      }
      finish(Object.freeze({ ok: true }));
    };
  });
}

function openAndCreateFreshCoreDb(
  input: ActivateYamlStorageCoreDbInput,
  initialState: YamlStorageActivationState,
  onState: (state: YamlStorageActivationState) => void
): Promise<UpgradeResult> {
  return new Promise((resolve) => {
    let settled = false;
    let creationStarted = false;
    let currentState = initialState;
    const finish = (result: UpgradeResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let request: IDBOpenDBRequest;
    try {
      request = input.environment.indexedDB.open(
        input.databaseName,
        CORE_DB_CANONICAL_NATIVE_VERSION
      );
    } catch {
      finish(Object.freeze({ ok: false, code: 'MIGRATION_TARGET_OPEN_FAILED' }));
      return;
    }
    request.onblocked = () => {
      if (currentState.phase !== 'opening-target') return;
      const nextState = reduceYamlStorageActivation(currentState, {
        type: 'target-open-blocked',
        activationId: currentState.activationId,
        openRequestId: input.openRequestId,
      });
      currentState = nextState;
      onState(nextState);
    };
    request.onerror = () => finish(Object.freeze({ ok: false, code: 'MIGRATION_UPGRADE_FAILED' }));
    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (
        transaction === null ||
        event.oldVersion !== 0 ||
        event.newVersion !== CORE_DB_CANONICAL_NATIVE_VERSION
      ) {
        transaction?.abort();
        return;
      }
      creationStarted = true;
      const nextState = reduceYamlStorageActivation(currentState, {
        type: 'versionchange-started',
        activationId: currentState.activationId,
        openRequestId: input.openRequestId,
      });
      currentState = nextState;
      onState(nextState);
      try {
        createCoreDbV2Schema(request.result);
      } catch {
        transaction.abort();
      }
    };
    request.onsuccess = () => {
      request.result.close();
      if (!creationStarted) {
        finish(Object.freeze({ ok: false, code: 'MIGRATION_TARGET_OPEN_FAILED' }));
        return;
      }
      finish(Object.freeze({ ok: true }));
    };
  });
}

async function validateActivatedCoreDb(input: ActivateYamlStorageCoreDbInput): Promise<
  | Readonly<{ readonly ok: true }>
  | Readonly<{
      readonly ok: false;
      readonly code: YamlStorageCoreDbErrorCode;
      readonly planningErrors?: YamlStorageCoreDbError['planningErrors'];
    }>
> {
  const opened = await openCoreDbAtExactVersion(
    input.environment.indexedDB,
    input.databaseName,
    CORE_DB_CANONICAL_NATIVE_VERSION
  );
  if (opened.ok === false) return opened;
  try {
    return await validateCanonicalYamlStorageCoreDb(
      opened.database,
      input.environment.digestSha256Hex
    );
  } finally {
    opened.database.close();
  }
}

/** Performs the only authorized CoreDB v1 to v2 canonical YAML activation. */
export async function activateYamlStorageCoreDb(
  input: ActivateYamlStorageCoreDbInput
): Promise<ActivateYamlStorageCoreDbResult> {
  let state: YamlStorageActivationState = input.state;
  if (!isValidInput(input)) return failedResult(state, 'INVALID_ACTIVATION_INPUT');

  const preflightOpen = await openExistingCoreDb(
    input.environment.indexedDB,
    input.databaseName,
    CORE_DB_LEGACY_NATIVE_VERSION
  );
  if (preflightOpen.ok === false) {
    if (preflightOpen.code !== 'CORE_DB_NOT_FOUND') {
      return failedResult(state, preflightOpen.code);
    }
    const fresh = createYamlStorageFreshActivation({
      activationId: state.activationId,
      targetVersion: state.targetVersion,
    });
    if (fresh.ok === false) return failedResult(state, 'INVALID_ACTIVATION_INPUT');
    state = reduceYamlStorageActivation(fresh.state, {
      type: 'quiescing-completed',
      activationId: fresh.state.activationId,
    });
    if (state.phase !== 'preflight') return failedResult(state, 'INVALID_ACTIVATION_INPUT');
    state = reduceYamlStorageActivation(state, {
      type: 'preflight-completed',
      activationId: state.activationId,
      openRequestId: input.openRequestId,
    });
    if (state.phase !== 'opening-target') return failedResult(state, 'INVALID_ACTIVATION_INPUT');
    const creationResult = await openAndCreateFreshCoreDb(input, state, (nextState) => {
      state = nextState;
    });
    if (creationResult.ok === false) return failedResult(state, creationResult.code);
  } else {
    let preflightNodes: readonly unknown[];
    try {
      if (!validateCoreDbV1Schema(preflightOpen.database)) {
        return failedResult(state, 'CORE_DB_SCHEMA_MISMATCH');
      }
      const rawNodes = await readAllCoreDbNodes(preflightOpen.database);
      const selected = selectYamlStorageRawNodes(rawNodes);
      if (!selected.ok) return failedResult(state, 'CORE_DB_SNAPSHOT_FAILED');
      preflightNodes = selected.rawYamlNodes;
    } catch {
      return failedResult(state, 'CORE_DB_SNAPSHOT_FAILED');
    } finally {
      preflightOpen.database.close();
    }

    let planningResult: Awaited<ReturnType<typeof planYamlCoreDbMigration>>;
    try {
      planningResult = await planYamlCoreDbMigration({
        migrationId: input.migrationId,
        fromCoreDbVersion: input.state.currentVersion,
        toCoreDbVersion: input.state.targetVersion,
        rawNodes: preflightNodes,
        digestSha256Hex: input.environment.digestSha256Hex,
      });
    } catch {
      return failedResult(state, 'MIGRATION_PREFLIGHT_FAILED');
    }
    if (planningResult.ok === false) {
      return failedResult(
        state,
        'MIGRATION_PREFLIGHT_FAILED',
        Object.freeze([...planningResult.errors])
      );
    }

    state = reduceYamlStorageActivation(state, {
      type: 'preflight-completed',
      activationId: state.activationId,
      openRequestId: input.openRequestId,
    });
    if (state.phase !== 'opening-target') return failedResult(state, 'INVALID_ACTIVATION_INPUT');

    const upgradeResult = await openAndUpgradeCoreDb(
      input,
      state,
      preflightNodes,
      planningResult.plan,
      (nextState) => {
        state = nextState;
      }
    );
    if (upgradeResult.ok === false) return failedResult(state, upgradeResult.code);
  }

  state = reduceYamlStorageActivation(state, {
    type: 'upgrade-committed',
    activationId: state.activationId,
    openRequestId: input.openRequestId,
  });
  if (state.phase !== 'initializing') return failedResult(state, 'MIGRATION_UPGRADE_FAILED');
  try {
    await input.environment.initializeCoreDb();
  } catch {
    return failedResult(state, 'CORE_DB_INITIALIZATION_FAILED');
  }
  const validationResult = await validateActivatedCoreDb(input);
  if (validationResult.ok === false) {
    return failedResult(state, validationResult.code, validationResult.planningErrors);
  }
  state = reduceYamlStorageActivation(state, {
    type: 'initialization-succeeded',
    activationId: state.activationId,
    openRequestId: input.openRequestId,
  });
  if (state.phase !== 'canonical-ready') {
    return failedResult(state, 'CORE_DB_INITIALIZATION_FAILED');
  }
  return Object.freeze({ ok: true, state });
}
