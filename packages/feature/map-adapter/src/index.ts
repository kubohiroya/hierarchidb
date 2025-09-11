export * from './types';
export * from './ports';
export * from './MapViewService';
export * from './adapters/MapLibreDeckAdapter';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/map-adapter', depends: ['@hierarchidb/map-source'], provides: ['map-adapter'] },
  init() {},
};

