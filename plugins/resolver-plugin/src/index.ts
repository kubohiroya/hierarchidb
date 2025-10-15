import type { ComponentType } from 'react';
import type { ResolverDialogProps } from './common/components/ResolverDialog.js';

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
} from './common/types/index.js';

export {
  ResolverEntityHandler,
  type ResolverSearchCriteria,
  type CreateResolverData,
} from './common/handlers/ResolverEntityHandler.js';

export { resolverDB } from './services/database/ResolverDatabase.js';

export {
  ResolverDialog,
  ResolverPanel,
} from './common/components/index.js';

export async function loadResolverEntityHandlerModule() {
  return import(/* @vite-ignore */ './common/handlers/ResolverEntityHandler.js');
}

export async function loadResolverDatabaseModule() {
  return import(/* @vite-ignore */ './services/database/ResolverDatabase.js');
}

export async function loadResolverDialogModule() {
  return import(/* @vite-ignore */ './common/components/ResolverDialog.js');
}

export async function loadResolverPanelModule() {
  return import(/* @vite-ignore */ './common/components/ResolverPanel.js');
}

// Standard entry for PluginDialogRoute to discover dialog component
export async function getDialogComponent(): Promise<ComponentType<ResolverDialogProps>> {
  const mod = await import('./common/components/ResolverDialog.js');
  return mod.ResolverDialog;
}

// Register host-composed steps on import (idempotent)
import './ui/steps-provider.js';

export { PLUGIN_MANIFEST as ResolverPluginManifest } from './plugin-manifest.js';

// Export services (to be implemented)
// export { MappingCompiler } from './services/MappingCompiler.js';
// export { ChainManager } from './services/ChainManager.js';
// export { SchemaDetector } from './services/SchemaDetector.js';

// Plugin definition exports removed: metadata is sourced from package.json

// Optional runtime wiring (register stub for runtime worker integration)
export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    // No resolver-specific runtime worker adapters are required at this point.
  }
}
