// Centralized feature flag reading for runtime-worker
// Make flags dynamic via getters so tests can mutate process.env between imports.

const envOn = (k: string) => (typeof process !== 'undefined' && (process as any)?.env?.[k]) === '1';

export const FEATURE_FLAGS = {
  get WORKER_USE_CMDPROC_CREATE_UPDATE() { return envOn('WORKER_USE_CMDPROC_CREATE_UPDATE'); },
  get WORKER_USE_CMDPROC_MOVE_REMOVE() { return envOn('WORKER_USE_CMDPROC_MOVE_REMOVE'); },
  get WORKER_WC_COMMIT_V2() { return envOn('WORKER_WC_COMMIT_V2'); },
  get WORKER_TRASH_USE_HOLDER() { return envOn('WORKER_TRASH_USE_HOLDER'); },
  get WORKER_METRICS_ENABLED() { return envOn('WORKER_METRICS_ENABLED'); },
  get WORKER_POLICY_C() { return envOn('WORKER_POLICY_C'); },
  get WORKER_TX_ENABLED() { return envOn('WORKER_TX_ENABLED'); },
  get WORKER_ENTITY_UNIFIED() { return envOn('WORKER_ENTITY_UNIFIED'); },
  // Common progress type adoption across plugins (UI-independent)
  get WORKER_PROGRESS_COMMON_TYPES() { return envOn('WORKER_PROGRESS_COMMON_TYPES'); },
  // Download strategy adoption (DI) for plugins
  get LOCATION_DOWNLOAD_STRATEGY() { return envOn('LOCATION_DOWNLOAD_STRATEGY'); },
  get SHAPE_DOWNLOAD_STRATEGY() { return envOn('SHAPE_DOWNLOAD_STRATEGY'); },
} as const;
