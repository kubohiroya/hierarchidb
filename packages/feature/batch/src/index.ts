export * from './BatchService';
export * from './ports';
export * from './capability';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/batch', depends: ['@hierarchidb/compute'], provides: ['batch'] },
  init() {},
};
