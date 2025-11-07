import type { ComponentType } from 'react';
import type { ResolverDialogProps } from './ui/components/ResolverDialog.js';

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
  ResolverDialog,
  ResolverPanel,
} from './ui/components/index.js';

export async function loadResolverEntityHandlerModule() {
  return import(/* @vite-ignore */ './worker/ResolverEntityService.js');
}

export async function loadResolverDialogModule() {
  return import(/* @vite-ignore */ './ui/components/ResolverDialog.js');
}

export async function loadResolverPanelModule() {
  return import(/* @vite-ignore */ './ui/components/ResolverPanel.js');
}

export async function getDialogComponent(): Promise<ComponentType<ResolverDialogProps>> {
  const mod = await import('./ui/components/ResolverDialog.js');
  return mod.ResolverDialog;
}

// Register host-composed steps on import (idempotent)
import './ui/components/steps-provider.js';

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
