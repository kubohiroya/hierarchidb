const readEnvFlag = (key: string, defaultValue: boolean): boolean => {
  if (typeof process === 'undefined') return defaultValue;
  const raw = process.env?.[key];
  if (raw === '1') return true;
  if (raw === '0') return false;
  return defaultValue;
};

// Runtime worker feature flags. Most flags remain permanently enabled but we keep
// the dynamic reader to avoid breaking existing environment-driven overrides.
export const FEATURE_FLAGS = Object.freeze({
  WORKER_TX_ENABLED: true,
  WORKER_METRICS_ENABLED: true,
  WORKER_ENTITY_UNIFIED: true,
  WORKER_POLICY_C: true,
  WORKER_WC_COMMIT_V2: true,
  WORKER_USE_CMDPROC_MOVE_REMOVE: readEnvFlag('WORKER_USE_CMDPROC_MOVE_REMOVE', false),
});

export type WorkerFeatureFlags = typeof FEATURE_FLAGS;
