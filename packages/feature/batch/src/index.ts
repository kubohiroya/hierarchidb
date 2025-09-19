export * from './BatchService.js';
export * from './ports.js';
export * from './capability.js';
export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/batch', depends: ['@hierarchidb/compute'], provides: ['batch'] };

  static init(): void {
    // no-op
  }
}
