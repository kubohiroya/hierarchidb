import type { ComponentType } from 'react';
import type { ResolverDialogProps } from './components/ResolverDialog.js';

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

export {
  ResolverEntityHandler,
  type ResolverSearchCriteria,
  type CreateResolverData,
} from './handlers/ResolverEntityHandler.js';

export { resolverDB } from './database/ResolverDatabase.js';

export {
  ResolverDialog,
  ResolverPanel,
} from './components/index.js';

export async function loadResolverEntityHandlerModule() {
  return import(/* @vite-ignore */ './handlers/ResolverEntityHandler.js');
}

export async function loadResolverDatabaseModule() {
  return import(/* @vite-ignore */ './database/ResolverDatabase.js');
}

export async function loadResolverDialogModule() {
  return import(/* @vite-ignore */ './components/ResolverDialog.js');
}

export async function loadResolverPanelModule() {
  return import(/* @vite-ignore */ './components/ResolverPanel.js');
}

// Standard entry for PluginDialogRoute to discover dialog component
export async function getDialogComponent(): Promise<ComponentType<ResolverDialogProps>> {
  const mod = await import('./components/ResolverDialog.js');
  return mod.ResolverDialog;
}

// Register host-composed steps on import (idempotent)
import './ui/steps-provider';

export { PLUGIN_MANIFEST as ResolverPluginManifest } from './extension/plugin-manifest.js';

// Export services (to be implemented)
// export { MappingCompiler } from './services/MappingCompiler.js';
// export { ChainManager } from './services/ChainManager.js';
// export { SchemaDetector } from './services/SchemaDetector.js';

// Plugin definition exports removed: metadata is sourced from package.json

// Optional runtime wiring (no-op)
export class RuntimeWiring {}
