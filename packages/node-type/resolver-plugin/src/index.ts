
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
} from './types';

// Export handlers
export {
  ResolverEntityHandler,
  type ResolverSearchCriteria,
  type CreateResolverData,
} from './handlers/ResolverEntityHandler';

// Export database
export { resolverDB } from './database/ResolverDatabase';

// Export components
export {
  ResolverDialog,
  ResolverPanel,
} from './components';

// Standard entry for PluginDialogRoute to discover dialog component
export async function getDialogComponent() {
  const mod = await import('./components/ResolverDialog');
  return (mod as any).ResolverDialog;
}

// Register host-composed steps on import (idempotent)
import './ui/steps-provider';

// Export services (to be implemented)
// export { MappingCompiler } from './services/MappingCompiler';
// export { ChainManager } from './services/ChainManager';
// export { SchemaDetector } from './services/SchemaDetector';

// Plugin definition exports removed: metadata is sourced from package.json

// Optional runtime wiring (no-op)
export const runtimeWiring = {} as const;
