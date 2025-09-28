import type { ComponentType } from 'react';
import { registerRuntimeWorkerNotImplemented } from '@hierarchidb/plugins-runtime-worker-factory';
import type { ResolverDialogProps } from './components/ResolverDialog.js';

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
export async function getDialogComponent(): Promise<ComponentType<ResolverDialogProps>> {
  const mod = await import('./components/ResolverDialog.js');
  return mod.ResolverDialog;
}

// Register host-composed steps on import (idempotent)
import './ui/steps-provider';

// Export services (to be implemented)
// export { MappingCompiler } from './services/MappingCompiler.js';
// export { ChainManager } from './services/ChainManager.js';
// export { SchemaDetector } from './services/SchemaDetector.js';

// Plugin definition exports removed: metadata is sourced from package.json

// Optional runtime wiring (register stub for runtime worker integration)
export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    registerRuntimeWorkerNotImplemented('resolver', '[resolver-plugin] runtime worker integration is not implemented yet');
  }
}
