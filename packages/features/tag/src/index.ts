export * from './TagService.js';
export * from './ports.js';
export * from './capability.js';
export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/tag', provides: ['taggable'] };
  static init(): void {
    // no-op
  }
}
