export type {
  DataTransformation,
  DuplicateResolutionStrategy,
  MappingPreviewResult,
  MappingValidationResult,
  PropertyInfo,
  PropertyMappingRule,
  ResolverEntity,
  ResolverUpdaterPayload,
  SchemaInfo,
  StylerIntegration,
  ValidationRule,
} from './common/types/index.js';

export async function loadResolverPanelModule() {
  return import(/* @vite-ignore */ './ui/components/ResolverPanel.js');
}

export async function getDialogComponent() {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(
      '[resolver-plugin] getDialogComponent() is deprecated. Dialogs are provided by PluginDialogHost.'
    );
  }
  return () => null;
}

export { PLUGIN_MANIFEST as ResolverPluginManifest } from './plugin-manifest.js';
