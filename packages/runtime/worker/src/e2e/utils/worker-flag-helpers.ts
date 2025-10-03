/**
 * Shared helpers for worker feature flag overrides in tests.
 *
 * Provides utility functions to synchronize override state between the
 * Vitest-based WFL scenarios and Playwright E2E suites. The helpers ensure that
 * overrides are applied and cleaned up in a consistent way so that individual
 * tests do not leak flag state to subsequent runs.
 */

import {
  WORKER_FLAG_ALLOWED_OVERRIDES,
  WORKER_FLAG_OVERRIDES_STORAGE_KEY,
  type WorkerFlagOverrideName,
} from '../../../../../../app/src/config/worker-flag-overrides.js';

export type WorkerFlagOverrideValue = '0' | '1';
export type WorkerFlagOverrideSetting = WorkerFlagOverrideValue | null | undefined;
export type WorkerFlagOverrideMap = Partial<Record<WorkerFlagOverrideName, WorkerFlagOverrideSetting>>;

export type WorkerFlagEnv = Record<string, string | undefined>;

type WorkerFlagEnvSnapshot = Map<WorkerFlagOverrideName, WorkerFlagOverrideSetting>;

const createEnvSnapshot = (
  env: WorkerFlagEnv,
  defaults?: WorkerFlagOverrideMap,
): WorkerFlagEnvSnapshot => {
  const snapshot: WorkerFlagEnvSnapshot = new Map();
  for (const flag of WORKER_FLAG_ALLOWED_OVERRIDES) {
    const hasDefault = defaults && Object.prototype.hasOwnProperty.call(defaults, flag);
    const value = hasDefault ? defaults![flag] : env[flag];
    snapshot.set(flag, (value ?? null) as WorkerFlagOverrideSetting);
  }
  return snapshot;
};

const applyEnvSnapshot = (snapshot: WorkerFlagEnvSnapshot, env: WorkerFlagEnv): void => {
  for (const flag of WORKER_FLAG_ALLOWED_OVERRIDES) {
    const value = snapshot.get(flag);
    if (value === '0' || value === '1') {
      env[flag] = value;
    } else {
      delete env[flag];
    }
  }
};

/**
 * Applies flag overrides to the provided environment record and returns a
 * function that restores the previous values. Flags set to `null` or
 * `undefined` are removed from the environment.
 */
export function withWorkerFlagEnvOverrides(
  overrides: WorkerFlagOverrideMap,
  env: WorkerFlagEnv = process.env,
): () => void {
  const snapshot = new Map<WorkerFlagOverrideName, string | undefined>();
  for (const flag of WORKER_FLAG_ALLOWED_OVERRIDES) {
    snapshot.set(flag, env[flag]);
    const next = overrides[flag];
    if (next === '0' || next === '1') {
      env[flag] = next;
    } else {
      delete env[flag];
    }
  }
  return () => {
    for (const flag of WORKER_FLAG_ALLOWED_OVERRIDES) {
      const previous = snapshot.get(flag);
      if (previous === undefined) {
        delete env[flag];
      } else {
        env[flag] = previous;
      }
    }
  };
}

/**
 * Serializes the provided overrides into the JSON payload consumed by the
 * worker bootstrap. Returns `null` when no valid overrides are present.
 */
export function createWorkerFlagOverridePayload(
  overrides: WorkerFlagOverrideMap | null | undefined,
): string | null {
  if (!overrides) return null;
  const payload: Partial<Record<WorkerFlagOverrideName, WorkerFlagOverrideValue>> = {};
  for (const flag of WORKER_FLAG_ALLOWED_OVERRIDES) {
    const value = overrides[flag];
    if (value === '0' || value === '1') {
      payload[flag] = value;
    }
  }
  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
}

export const WORKER_FLAG_STORAGE_KEY = WORKER_FLAG_OVERRIDES_STORAGE_KEY;

export type WorkerFlagOverrideLifecycle = {
  resetEnv(): void;
  applyEnvOverrides(overrides: WorkerFlagOverrideMap): () => void;
  createPayload(overrides: WorkerFlagOverrideMap | null | undefined): string | null;
};

export function createWorkerFlagOverrideLifecycle(
  env: WorkerFlagEnv = process.env,
  defaults?: WorkerFlagOverrideMap,
): WorkerFlagOverrideLifecycle {
  const baseline = createEnvSnapshot(env, defaults);

  const resetEnv = () => {
    applyEnvSnapshot(baseline, env);
  };

  const applyEnvOverrides = (overrides: WorkerFlagOverrideMap): (() => void) => {
    resetEnv();
    const restore = withWorkerFlagEnvOverrides(overrides, env);
    return () => {
      restore();
      resetEnv();
    };
  };

  const createPayload = (overrides: WorkerFlagOverrideMap | null | undefined): string | null => {
    return createWorkerFlagOverridePayload(overrides);
  };

  return {
    resetEnv,
    applyEnvOverrides,
    createPayload,
  };
}
