export * from './TagService';
export * from './ports';
export * from './capability';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/tag', provides: ['taggable'] },
  init() {},
};
