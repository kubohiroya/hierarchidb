// Centralized feature flag reading for runtime-worker
// Note: Flags are fixed at startup. Default is OFF for safety.

export const FEATURE_FLAGS = {
  WORKER_USE_CMDPROC_CREATE_UPDATE:
    (typeof process !== 'undefined' && process?.env?.WORKER_USE_CMDPROC_CREATE_UPDATE) === '1',
  WORKER_USE_CMDPROC_MOVE_REMOVE:
    (typeof process !== 'undefined' && process?.env?.WORKER_USE_CMDPROC_MOVE_REMOVE) === '1',
  WORKER_WC_COMMIT_V2:
    (typeof process !== 'undefined' && process?.env?.WORKER_WC_COMMIT_V2) === '1',
  WORKER_TRASH_USE_HOLDER:
    (typeof process !== 'undefined' && process?.env?.WORKER_TRASH_USE_HOLDER) === '1',
  WORKER_METRICS_ENABLED:
    (typeof process !== 'undefined' && process?.env?.WORKER_METRICS_ENABLED) === '1',
  WORKER_POLICY_C:
    (typeof process !== 'undefined' && process?.env?.WORKER_POLICY_C) === '1',
  WORKER_TX_ENABLED:
    (typeof process !== 'undefined' && process?.env?.WORKER_TX_ENABLED) === '1',
  WORKER_ENTITY_UNIFIED:
    (typeof process !== 'undefined' && process?.env?.WORKER_ENTITY_UNIFIED) === '1',
} as const;
