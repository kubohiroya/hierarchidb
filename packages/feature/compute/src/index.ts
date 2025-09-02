export * from './types';
export * from './ports';
export * from './WorkerPool';
export * from './ComputeService';
export * from './capability';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/compute', provides: ['worker-pool', 'compute-batch'] },
  init() {},
};
