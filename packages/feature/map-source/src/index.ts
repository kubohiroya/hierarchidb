export * from './ports.js';
export * from './MapSourceService.js';
export * from './adapters/DexieShapePort.js';
export * from './ports.spatial.js';
export * from './adapters/FeatureCollectionGridIndex.js';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/map-source', provides: ['map-source'] },
  init() {
  },
};
