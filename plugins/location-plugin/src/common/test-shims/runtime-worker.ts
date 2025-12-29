// Minimal stub for @hierarchidb/runtime-worker-worker used in Vitest.
// Location plugin unit tests do not execute real worker logic; this file
// satisfies dynamic imports originating from runtime-worker-shared module paths.

export const workerBootstrap = {
  initialize: async () => undefined,
};

export const workerAPI = {
  startBatchSession: async () => ({
    nodeId: 'stub-node',
    status: 'running' as const,
  }),
  getBatchSessionStatus: async () => ({
    nodeId: 'stub-node',
    status: 'running' as const,
  }),
  pauseBatchSession: async () => undefined,
  resumeBatchSession: async () => undefined,
  cancelBatchSession: async () => undefined,
  subscribeBatchProgress: async () => () => undefined,
};

export default {
  workerBootstrap,
  workerAPI,
};
