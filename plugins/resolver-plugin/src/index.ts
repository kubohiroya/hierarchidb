
export type {
  ResolverEntity,
  ResolverDraftEntity,
  ResolverDraft,
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
  ResolverPanel,
} from './ui/components/index.js';

export async function loadResolverEntityHandlerModule() {
  return import(/* @vite-ignore */ './worker/ResolverEntityService.js');
}

export async function loadResolverPanelModule() {
  return import(/* @vite-ignore */ './ui/components/ResolverPanel.js');
}

export async function getDialogComponent() {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('[resolver-plugin] getDialogComponent() is deprecated. Dialogs are provided by PluginDialogHost.');
  }
  return () => null;
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
