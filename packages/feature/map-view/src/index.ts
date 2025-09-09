export * from './types';
export * from './ports';
export * from './MapViewService';
export * from './adapters/MapLibreDeckAdapter';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/map-view', depends: ['@hierarchidb/map-source'], provides: ['map-view'] },
  init() {
  },
};
