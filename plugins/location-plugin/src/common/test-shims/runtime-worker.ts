// Minimal stub for @hierarchidb/runtime-worker-worker used in Vitest.
// Location plugin unit tests do not execute real worker logic; this file
// satisfies dynamic imports originating from runtime-worker-shared module paths.

export const workerBootstrap = {
  initialize: async () => undefined,
};

export const workerAPI = {
  startBuildSession: async () => ({
    nodeId: 'stub-node',
    status: 'running' as const,
  }),
  startBatchSession: async () => ({
    nodeId: 'stub-node',
    status: 'running' as const,
  }),
  getBuildSessionStatus: async () => ({
    nodeId: 'stub-node',
    status: 'running' as const,
  }),
  getBatchSessionStatus: async () => ({
    nodeId: 'stub-node',
    status: 'running' as const,
  }),
  pauseBuildSession: async () => undefined,
  pauseBatchSession: async () => undefined,
  resumeBuildSession: async () => undefined,
  resumeBatchSession: async () => undefined,
  subscribeBuildProgress: async () => () => undefined,
  subscribeBatchProgress: async () => () => undefined,
};

export default {
  workerBootstrap,
  workerAPI,
};
