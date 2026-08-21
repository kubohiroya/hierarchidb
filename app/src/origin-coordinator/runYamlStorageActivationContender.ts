import type { YamlStorageCanonicalReadyState } from '@hierarchidb/runtime-worker/yaml-storage-activation';
import {
  createYamlStorageActivation,
  reduceYamlStorageActivation,
} from '@hierarchidb/runtime-worker/yaml-storage-activation';
import type {
  ActivateYamlStorageCoreDbInput,
  ActivateYamlStorageCoreDbResult,
} from '@hierarchidb/runtime-worker/yaml-storage-production';
import type { OriginCoordinatorClientHandle } from './types.js';

export type YamlStorageActivationContenderErrorCode =
  | 'CRYPTO_IDENTITY_UNAVAILABLE'
  | 'CRYPTO_IDENTITY_INVALID'
  | 'ACTIVATION_STATE_REJECTED'
  | 'QUIESCENCE_NOT_READY'
  | 'CORE_DB_ACTIVATION_FAILED'
  | 'CANONICAL_READY_EVIDENCE_INVALID';

export class YamlStorageActivationContenderError extends Error {
  constructor(readonly code: YamlStorageActivationContenderErrorCode) {
    super(`YAML storage activation failed: ${code}`);
    this.name = 'YamlStorageActivationContenderError';
  }
}

export interface RunYamlStorageActivationContenderInput {
  readonly coordinator: OriginCoordinatorClientHandle;
  readonly quiescenceTimeoutMs: number;
  readonly createIdentity: () => string;
  readonly activateCoreDb: (
    input: Pick<ActivateYamlStorageCoreDbInput, 'state' | 'migrationId' | 'openRequestId'>
  ) => Promise<ActivateYamlStorageCoreDbResult>;
}

/** Claims the coordinator gate and runs storage activation for the sole winning identity. */
export async function runYamlStorageActivationContender(
  input: RunYamlStorageActivationContenderInput
): Promise<YamlStorageCanonicalReadyState> {
  if (typeof input.createIdentity !== 'function') {
    throw new YamlStorageActivationContenderError('CRYPTO_IDENTITY_UNAVAILABLE');
  }
  let identities: readonly string[];
  try {
    identities = Object.freeze([
      input.createIdentity(),
      input.createIdentity(),
      input.createIdentity(),
      input.createIdentity(),
    ]);
  } catch {
    throw new YamlStorageActivationContenderError('CRYPTO_IDENTITY_UNAVAILABLE');
  }
  if (
    identities.some((identity) => typeof identity !== 'string' || identity.length === 0) ||
    new Set(identities).size !== identities.length
  ) {
    throw new YamlStorageActivationContenderError('CRYPTO_IDENTITY_INVALID');
  }
  const [activationId, quiescenceRequestId, migrationId, openRequestId] = identities;
  if (
    activationId === undefined ||
    quiescenceRequestId === undefined ||
    migrationId === undefined ||
    openRequestId === undefined
  ) {
    throw new YamlStorageActivationContenderError('CRYPTO_IDENTITY_INVALID');
  }

  const created = createYamlStorageActivation({
    activationId,
    currentVersion: 1,
    targetVersion: 2,
  });
  if (created.ok === false) {
    throw new YamlStorageActivationContenderError('ACTIVATION_STATE_REJECTED');
  }
  const quiescence = await input.coordinator.startQuiescence({
    activationId,
    quiescenceRequestId,
    timeoutMs: input.quiescenceTimeoutMs,
  });
  if (
    quiescence.status !== 'ready-for-preflight' ||
    quiescence.activationId !== activationId ||
    quiescence.quiescenceRequestId !== quiescenceRequestId
  ) {
    throw new YamlStorageActivationContenderError('QUIESCENCE_NOT_READY');
  }
  const preflightState = reduceYamlStorageActivation(created.state, {
    type: 'quiescing-completed',
    activationId,
  });
  if (preflightState.phase !== 'preflight') {
    throw new YamlStorageActivationContenderError('ACTIVATION_STATE_REJECTED');
  }
  const activated = await input.activateCoreDb({
    state: preflightState,
    migrationId,
    openRequestId,
  });
  if (activated.ok === false) {
    throw new YamlStorageActivationContenderError('CORE_DB_ACTIVATION_FAILED');
  }
  const hasValidReadinessProof =
    (activated.state.currentVersion === 1 &&
      activated.state.readinessProof === 'same-activation-upgrade') ||
    (activated.state.currentVersion === 0 &&
      activated.state.readinessProof === 'same-activation-fresh-create');
  if (
    activated.state.activationId !== activationId ||
    activated.state.openRequestId !== openRequestId ||
    activated.state.targetVersion !== 2 ||
    !hasValidReadinessProof
  ) {
    throw new YamlStorageActivationContenderError('CANONICAL_READY_EVIDENCE_INVALID');
  }
  return activated.state;
}
