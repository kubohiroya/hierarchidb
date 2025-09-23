export * from './ImportExportService.js';
export * from './ports.js';
export * from './capability.js';
export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/import-export', provides: ['import', 'export'] };

  static init(): void {
    // no-op
  }
}
