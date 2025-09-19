export * from './TagService.js';
export * from './ports.js';
export * from './capability.js';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/tag', provides: ['taggable'] },
  init() {
  },
};
