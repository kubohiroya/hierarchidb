export {
  clearResolverDatabases,
  clearResolverDatabases as clearDatabases,
  closeResolverDB,
  getResolverDB,
  initializeResolverDB,
  ResolverDB,
  type ResolverEntity,
} from './ResolverDB.js';
export type {
  ResolverFeatureTargetKind,
  ResolverStyleBinding,
  ResolverStyleBindingTargetKind,
  ResolverStyleBindingValidationCode,
  ResolverStyleBindingValidationIssue,
  ResolverStyleBindingValidationResult,
  ResolverStyleProperty,
} from './styleBindingTypes.js';
export {
  RESOLVER_FORBIDDEN_STYLE_BINDING_FIELDS,
  RESOLVER_STYLE_BINDING_VERSION,
  RESOLVER_STYLE_PROPERTIES_BY_TARGET_KIND,
} from './styleBindingTypes.js';
