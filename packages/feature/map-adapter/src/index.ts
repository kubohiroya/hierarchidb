export * from './types.js';
export * from './ports.js';
export * from './MapViewService.js';
export * from './adapters/MapLibreDeckAdapter.js';
export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/map-adapter', depends: ['@hierarchidb/map-source'], provides: ['map-adapter'] };

  static init(): void {
    // no-op
  }
}

