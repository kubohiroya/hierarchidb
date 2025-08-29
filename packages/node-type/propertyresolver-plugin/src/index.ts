import { PropertyResolverDefinition } from './definitions/PropertyResolverDefinition';

// Export types
export type {
  PropertyResolverEntity,
  PropertyResolverWorkingCopyEntity,
  PropertyMappingRule,
  ValidationRule,
  DuplicateResolutionStrategy,
  DataTransformation,
  SchemaInfo,
  PropertyInfo,
  MappingValidationResult,
  MappingPreviewResult,
  StyleMapIntegration,
} from './types';

// Export handlers
export { PropertyResolverEntityHandler } from './handlers/PropertyResolverEntityHandler';

// Export components
export {
  PropertyResolverDialog,
  PropertyResolverPanel,
} from './components';

// Export services (to be implemented)
// export { MappingCompiler } from './services/MappingCompiler';
// export { ChainManager } from './services/ChainManager';
// export { SchemaDetector } from './services/SchemaDetector';

// Plugin registration
export const PropertyResolverPlugin = {
  ...PropertyResolverDefinition,
  ui: {
    dialogComponentPath: '@hierarchidb/propertyresolver-plugin/components/PropertyResolverDialog',
    panelComponentPath: '@hierarchidb/propertyresolver-plugin/components/PropertyResolverPanel',
  }
} as const;

// Default export for convenient plugin registration
export default PropertyResolverPlugin;