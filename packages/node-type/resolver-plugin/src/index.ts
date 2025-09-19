
// Export types
export type {
  ResolverEntity,
  ResolverWorkingCopyEntity,
  ResolverWorkingCopy,
  PropertyMappingRule,
  ValidationRule,
  DuplicateResolutionStrategy,
  DataTransformation,
  SchemaInfo,
  PropertyInfo,
  MappingValidationResult,
  MappingPreviewResult,
  StylerIntegration,
} from './types/index.js';

// Export handlers
export {
  ResolverEntityHandler,
  type ResolverSearchCriteria,
  type CreateResolverData,
} from './handlers/ResolverEntityHandler.js';

// Export database
export { resolverDB } from './database/ResolverDatabase.js';

// Export components
export {
  ResolverDialog,
  ResolverPanel,
} from './components/index.js';

// Standard entry for PluginDialogRoute to discover dialog component
export async function getDialogComponent() {
  const mod = await import('./components/ResolverDialog.js');
  return (mod as any).ResolverDialog;
}

// Register host-composed steps on import (idempotent)
import './ui/steps-provider';

// Export services (to be implemented)
// export { MappingCompiler } from './services/MappingCompiler.js';
// export { ChainManager } from './services/ChainManager.js';
// export { SchemaDetector } from './services/SchemaDetector.js';

// Plugin definition exports removed: metadata is sourced from package.json

// Optional runtime wiring (no-op)
export const runtimeWiring = {} as const;
