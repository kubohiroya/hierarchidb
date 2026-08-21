import { isYamlStorageActualFenceEstablished } from './getYamlStorageAccessDecision.js';
import {
  freezeIssuedYamlStorageActivationState,
  isIssuedYamlStorageActivationState,
} from './yamlStorageActivationProvenanceUtils.js';
import type {
  YamlStorageActivationCreateResult,
  YamlStorageActivationError,
  YamlStorageActivationErrorCode,
  YamlStorageActivationErrorStage,
  YamlStorageActivationEvent,
  YamlStorageActivationInput,
  YamlStorageActivationState,
  YamlStorageFreshActivationInput,
  YamlStorageRejectedState,
} from './yamlStorageActivationTypes.js';

function freezeError(
  code: YamlStorageActivationErrorCode,
  stage: YamlStorageActivationErrorStage
): YamlStorageActivationError {
  return Object.freeze({ code, stage });
}

function freezeState<T extends YamlStorageActivationState>(state: T): T {
  return freezeIssuedYamlStorageActivationState(state);
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function reject(
  state: Exclude<YamlStorageActivationState, YamlStorageRejectedState>,
  code: YamlStorageActivationErrorCode,
  stage: YamlStorageActivationErrorStage = state.phase
): YamlStorageRejectedState {
  const openRequestContext = 'openRequestId' in state ? { openRequestId: state.openRequestId } : {};
  return freezeState({
    phase: 'rejected',
    activationId: state.activationId,
    currentVersion: state.currentVersion,
    targetVersion: state.targetVersion,
    ...openRequestContext,
    actualFenceEstablished: isYamlStorageActualFenceEstablished(state),
    error: freezeError(code, stage),
  });
}

function failureCodeForStage(
  stage: Exclude<YamlStorageActivationErrorStage, 'input'>
): YamlStorageActivationErrorCode {
  switch (stage) {
    case 'quiescing':
      return 'QUIESCING_FAILED';
    case 'preflight':
      return 'PREFLIGHT_FAILED';
    case 'opening-target':
    case 'blocked':
      return 'TARGET_OPEN_FAILED';
    case 'versionchanging':
      return 'UPGRADE_FAILED';
    case 'initializing':
    case 'canonical-ready':
      return 'INITIALIZATION_FAILED';
    case 'post-activation-boot':
      return 'INVALID_POST_ACTIVATION_EVIDENCE';
    default: {
      const exhaustiveStage: never = stage;
      return exhaustiveStage;
    }
  }
}

export function createYamlStorageActivation(
  input: YamlStorageActivationInput
): YamlStorageActivationCreateResult {
  if (typeof input.activationId !== 'string' || input.activationId.length === 0) {
    return Object.freeze({ ok: false, error: freezeError('INVALID_ACTIVATION_ID', 'input') });
  }
  if (!isPositiveSafeInteger(input.currentVersion)) {
    return Object.freeze({ ok: false, error: freezeError('INVALID_CURRENT_VERSION', 'input') });
  }
  if (!isPositiveSafeInteger(input.targetVersion)) {
    return Object.freeze({ ok: false, error: freezeError('INVALID_TARGET_VERSION', 'input') });
  }
  if (input.targetVersion <= input.currentVersion) {
    return Object.freeze({ ok: false, error: freezeError('INVALID_VERSION_RANGE', 'input') });
  }
  return Object.freeze({
    ok: true,
    state: freezeState({
      phase: 'quiescing',
      activationId: input.activationId,
      currentVersion: input.currentVersion,
      targetVersion: input.targetVersion,
    }),
  });
}

/** Issues the activation state used only after authoritative discovery proves CoreDB is absent. */
export function createYamlStorageFreshActivation(
  input: YamlStorageFreshActivationInput
): YamlStorageActivationCreateResult {
  if (typeof input.activationId !== 'string' || input.activationId.length === 0) {
    return Object.freeze({ ok: false, error: freezeError('INVALID_ACTIVATION_ID', 'input') });
  }
  if (!isPositiveSafeInteger(input.targetVersion)) {
    return Object.freeze({ ok: false, error: freezeError('INVALID_TARGET_VERSION', 'input') });
  }
  return Object.freeze({
    ok: true,
    state: freezeState({
      phase: 'quiescing',
      activationId: input.activationId,
      currentVersion: 0,
      targetVersion: input.targetVersion,
    }),
  });
}

export function reduceYamlStorageActivation(
  state: YamlStorageActivationState,
  event: YamlStorageActivationEvent
): YamlStorageActivationState {
  if (!isIssuedYamlStorageActivationState(state)) {
    return state;
  }
  if (state.phase === 'rejected') {
    return state;
  }
  if (event.activationId !== state.activationId) {
    return reject(state, 'ACTIVATION_ID_MISMATCH');
  }
  if (
    'openRequestId' in event &&
    (typeof event.openRequestId !== 'string' || event.openRequestId.length === 0)
  ) {
    return reject(state, 'INVALID_OPEN_REQUEST_ID');
  }
  if (
    'openRequestId' in state &&
    'openRequestId' in event &&
    event.openRequestId !== state.openRequestId
  ) {
    return reject(state, 'OPEN_REQUEST_ID_MISMATCH');
  }
  if (event.type === 'activation-rejected') {
    if (event.stage !== state.phase) {
      return reject(state, 'ILLEGAL_TRANSITION');
    }
    return reject(state, failureCodeForStage(state.phase));
  }

  switch (state.phase) {
    case 'quiescing':
      if (event.type === 'quiescing-completed') {
        return freezeState({ ...state, phase: 'preflight' });
      }
      return reject(state, 'ILLEGAL_TRANSITION');
    case 'preflight':
      if (event.type === 'preflight-completed') {
        return freezeState({
          ...state,
          phase: 'opening-target',
          openRequestId: event.openRequestId,
        });
      }
      return reject(state, 'ILLEGAL_TRANSITION');
    case 'opening-target':
      if (event.type === 'target-open-blocked') {
        return freezeState({ ...state, phase: 'blocked' });
      }
      if (event.type === 'versionchange-started') {
        return freezeState({ ...state, phase: 'versionchanging' });
      }
      return reject(state, 'ILLEGAL_TRANSITION');
    case 'blocked':
      if (event.type === 'versionchange-started') {
        return freezeState({ ...state, phase: 'versionchanging' });
      }
      return reject(state, 'ILLEGAL_TRANSITION');
    case 'versionchanging':
      if (event.type === 'upgrade-committed') {
        return freezeState({ ...state, phase: 'initializing', upgradeCommitted: true });
      }
      return reject(state, 'ILLEGAL_TRANSITION');
    case 'initializing':
      if (event.type === 'initialization-succeeded') {
        return freezeState({
          ...state,
          phase: 'canonical-ready',
          upgradeCommitted: true,
          initializationSucceeded: true,
          readinessProof:
            state.currentVersion === 0 ? 'same-activation-fresh-create' : 'same-activation-upgrade',
        });
      }
      return reject(state, 'ILLEGAL_TRANSITION');
    case 'canonical-ready':
      return reject(state, 'ILLEGAL_TRANSITION');
    default: {
      const exhaustiveState: never = state;
      return exhaustiveState;
    }
  }
}
