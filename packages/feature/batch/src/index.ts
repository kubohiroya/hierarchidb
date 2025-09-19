export * from './BatchService.js';
export * from './ports.js';
export * from './capability.js';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/batch', depends: ['@hierarchidb/compute'], provides: ['batch'] },
  init() {
  },
};
