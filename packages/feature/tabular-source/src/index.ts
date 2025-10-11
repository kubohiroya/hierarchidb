export * from './types.js';
export * from './ports.js';
export * from './registry.js';
export * from './TabularService.js';
export * from './capability.js';
export * from './store.js';
export * from './processor.js';
export * from './processors/ColumnRenameProcessor.js';
export * from './processors/NumberCoerceProcessor.js';
export * from './processors/RequiredColumnsValidator.js';
export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/tabular-source', provides: ['tabular-source'] };

  static init(): void {
    // no-op
  }
}
