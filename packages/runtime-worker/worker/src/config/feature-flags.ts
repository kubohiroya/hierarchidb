// Worker flags are now permanently enabled. The constant remains to avoid
// breaking tests or third-party scripts that import these symbols.
export const FEATURE_FLAGS = Object.freeze({
  WORKER_TX_ENABLED: true,
  WORKER_METRICS_ENABLED: true,
  WORKER_ENTITY_UNIFIED: true,
  WORKER_POLICY_C: true,
  WORKER_WC_COMMIT_V2: true,
});

export type WorkerFeatureFlags = typeof FEATURE_FLAGS;
