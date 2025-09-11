// Centralized feature flag reading for runtime-worker
// Make flags dynamic via getters so tests can mutate a global feature object.

const flagOn = (k: string, def = false) => {
  const g: any = (globalThis as any);
  const v = g?.FEATURE_FLAGS?.[k];
  if (v == null) return !!def;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'enabled';
};

export const FEATURE_FLAGS = {
  get WORKER_USE_CMDPROC_CREATE_UPDATE() { return flagOn('WORKER_USE_CMDPROC_CREATE_UPDATE'); },
  get WORKER_USE_CMDPROC_MOVE_REMOVE() { return flagOn('WORKER_USE_CMDPROC_MOVE_REMOVE'); },
  // Defaults flipped to ON for latest implementation
  get WORKER_WC_COMMIT_V2() { return flagOn('WORKER_WC_COMMIT_V2', true); },
  get WORKER_TRASH_USE_HOLDER() { return flagOn('WORKER_TRASH_USE_HOLDER', true); },
  get WORKER_METRICS_ENABLED() { return flagOn('WORKER_METRICS_ENABLED'); },
  get WORKER_POLICY_C() { return flagOn('WORKER_POLICY_C'); },
  get WORKER_TX_ENABLED() { return flagOn('WORKER_TX_ENABLED'); },
  get WORKER_ENTITY_UNIFIED() { return flagOn('WORKER_ENTITY_UNIFIED', true); },
  // Common progress type adoption across plugins (UI-independent)
  get WORKER_PROGRESS_COMMON_TYPES() { return flagOn('WORKER_PROGRESS_COMMON_TYPES'); },
  // Download strategy adoption (DI) for plugins
  get LOCATION_DOWNLOAD_STRATEGY() { return flagOn('LOCATION_DOWNLOAD_STRATEGY'); },
  get SHAPE_DOWNLOAD_STRATEGY() { return flagOn('SHAPE_DOWNLOAD_STRATEGY'); },
} as const;
