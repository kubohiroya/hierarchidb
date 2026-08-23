import type { BuildSessionRuntimeStatus, CanonicalBuildInputSource } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { WorkerService } from '@hierarchidb/runtime-worker';

export type ShapeBuildRuntimeAdapterHooks = {
  configureShapeCanonicalBuildRuntimeAdapter(deps: {
    queryAPI: ReturnType<WorkerService['getShapeQueryAPI']>;
    mutationAPI: ReturnType<WorkerService['getShapeMutationAPI']>;
  }): void;
  setShapeBuildRuntimeInputSource(nodeId: NodeId, inputSource: CanonicalBuildInputSource): void;
  setShapeBuildRuntimeTransientStatus(nodeId: NodeId, status: BuildSessionRuntimeStatus): void;
  clearShapeBuildRuntimeTransientStatus(nodeId: NodeId): void;
};

export const resolveShapeBuildRuntimeAdapterHooks = (
  mod: unknown
): ShapeBuildRuntimeAdapterHooks => {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) {
    throw new Error('[worker bootstrap] Shape worker module must be an object');
  }
  const record = mod as Record<string, unknown>;
  for (const methodName of [
    'configureShapeCanonicalBuildRuntimeAdapter',
    'setShapeBuildRuntimeInputSource',
    'setShapeBuildRuntimeTransientStatus',
    'clearShapeBuildRuntimeTransientStatus',
  ] as const) {
    if (typeof record[methodName] !== 'function') {
      throw new Error(
        `[worker bootstrap] shape runtime adapter hook ${methodName} must be a function`
      );
    }
  }
  return record as ShapeBuildRuntimeAdapterHooks;
};
