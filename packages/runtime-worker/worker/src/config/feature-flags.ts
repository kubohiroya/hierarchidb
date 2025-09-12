// Flags with env overrides for tests. Defaults stay aligned with production.
const env = (typeof process !== 'undefined' ? (process as any).env : undefined) as
  | Record<string, string | undefined>
  | undefined;
const envBool = (name: string, def: boolean) => {
  const v = env?.[name];
  if (v == null) return def;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes';
};

// Fixed flags for worker commit/mutation routing (default ON)
export const WORKER_WC_COMMIT_V2 = envBool('WORKER_WC_COMMIT_V2', true);
export const WORKER_USE_CMDPROC_CREATE_UPDATE = envBool('WORKER_USE_CMDPROC_CREATE_UPDATE', true);
export const WORKER_USE_CMDPROC_MOVE_REMOVE = envBool('WORKER_USE_CMDPROC_MOVE_REMOVE', true);
export const WORKER_TRASH_USE_HOLDER = envBool('WORKER_TRASH_USE_HOLDER', true);
export const WORKER_ENTITY_UNIFIED = envBool('WORKER_ENTITY_UNIFIED', true);
export const WORKER_TX_ENABLED = envBool('WORKER_TX_ENABLED', true);
export const WORKER_POLICY_C = envBool('WORKER_POLICY_C', true);
export const WORKER_METRICS_ENABLED = envBool('WORKER_METRICS_ENABLED', false);

export const FEATURE_FLAGS = {
  WORKER_WC_COMMIT_V2,
  WORKER_USE_CMDPROC_CREATE_UPDATE,
  WORKER_USE_CMDPROC_MOVE_REMOVE,
  WORKER_TRASH_USE_HOLDER,
  WORKER_ENTITY_UNIFIED,
  WORKER_TX_ENABLED,
  WORKER_POLICY_C,
  WORKER_METRICS_ENABLED,
};
