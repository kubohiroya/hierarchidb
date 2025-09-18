export * from './types.js';
export * from './ports.js';
export * from './WorkerPool.js';
export * from './ComputeService.js';
export * from './capability.js';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/compute', provides: ['worker-pool', 'compute-batch'] },
  init() {
  },
};
