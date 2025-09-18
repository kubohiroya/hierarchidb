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

// Disable TX wrapper by default in tests to avoid Dexie PrematureCommitError with multi-phase commands
export const WORKER_TX_ENABLED = envBool('WORKER_TX_ENABLED', false);
export const WORKER_METRICS_ENABLED = envBool('WORKER_METRICS_ENABLED', false);
export const WORKER_ENTITY_UNIFIED = envBool('WORKER_ENTITY_UNIFIED', false);
export const WORKER_POLICY_C = envBool('WORKER_POLICY_C', false);
export const WORKER_WC_COMMIT_V2 = envBool('WORKER_WC_COMMIT_V2', false);

export const FEATURE_FLAGS = {
  WORKER_TX_ENABLED,
  WORKER_METRICS_ENABLED,
  WORKER_ENTITY_UNIFIED,
  WORKER_POLICY_C,
  WORKER_WC_COMMIT_V2,
};
