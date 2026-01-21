export * from './ports.js';
export * from './MapSourceService.js';
export * from './ports.spatial.js';
export * from './adapters/FeatureCollectionGridIndex.js';
export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/map-source', provides: ['map-source'] };

  static init(): void {
    // no-op
  }
}
