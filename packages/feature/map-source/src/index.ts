export * from './ports';
export * from './MapSourceService';
export * from './adapters/DexieShapePort';
export * from './ports.spatial';
export * from './adapters/FeatureCollectionGridIndex';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/map-source', provides: ['map-source'] },
  init() {
  },
};
