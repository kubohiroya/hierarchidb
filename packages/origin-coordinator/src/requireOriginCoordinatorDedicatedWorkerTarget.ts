import type { OriginCoordinatorMessageTarget } from './types.js';

const INVALID_DEDICATED_WORKER_TARGET_ERROR = 'origin-coordinator-invalid-dedicated-worker-target';

function failInvalidDedicatedWorkerTarget(): never {
  throw new Error(INVALID_DEDICATED_WORKER_TARGET_ERROR);
}

export function requireOriginCoordinatorDedicatedWorkerTarget(
  target: unknown
): OriginCoordinatorMessageTarget {
  if (typeof target !== 'object' || target === null) {
    failInvalidDedicatedWorkerTarget();
  }

  try {
    if (
      Reflect.get(target, 'self') !== target ||
      Reflect.has(target, 'document') ||
      typeof Reflect.get(target, 'addEventListener') !== 'function' ||
      typeof Reflect.get(target, 'removeEventListener') !== 'function' ||
      typeof Reflect.get(target, 'postMessage') !== 'function'
    ) {
      failInvalidDedicatedWorkerTarget();
    }
  } catch {
    failInvalidDedicatedWorkerTarget();
  }

  return target as OriginCoordinatorMessageTarget;
}
