/**
 * Shared configuration for runtime worker feature flag overrides.
 *
 * E2E テストでは localStorage に JSON を保存し、Worker 起動時に URL パラメータとして渡します。
 * 本番環境ではキーが存在しないため、従来どおり既定値（環境変数）で動作します。
 */

export const WORKER_FLAG_OVERRIDES_STORAGE_KEY = 'hierarchidb:worker-flag-overrides';

export const WORKER_FLAG_ALLOWED_OVERRIDES = [
  'WORKER_USE_CMDPROC_MOVE_REMOVE',
] as const;

export type WorkerFlagOverrideName = (typeof WORKER_FLAG_ALLOWED_OVERRIDES)[number];

const allowedFlagSet = new Set<WorkerFlagOverrideName>(WORKER_FLAG_ALLOWED_OVERRIDES);

export function isAllowedWorkerFlag(flag: string): flag is WorkerFlagOverrideName {
  return allowedFlagSet.has(flag as WorkerFlagOverrideName);
}

export const WORKER_FLAG_PARAM_PREFIX = 'flag_';
