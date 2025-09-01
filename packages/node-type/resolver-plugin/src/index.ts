import { ResolverDefinition } from './definitions/ResolverDefinition';

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

// Export services (to be implemented)
// export { MappingCompiler } from './services/MappingCompiler';
// export { ChainManager } from './services/ChainManager';
// export { SchemaDetector } from './services/SchemaDetector';

// Plugin registration
export const ResolverPlugin = {
  ...ResolverDefinition,
  ui: {
    dialogComponentPath: '@hierarchidb/resolver-plugin/components/ResolverDialog',
    panelComponentPath: '@hierarchidb/resolver-plugin/components/ResolverPanel',
  }
} as const;

// Default export for convenient plugin registration
export default ResolverPlugin;