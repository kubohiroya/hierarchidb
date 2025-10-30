// No DB/handler exports; CoreDB.nodes is the source of truth.

// Basic components
// UI components moved to subpath export to keep root worker-safe

// Export types
export * from './common/types/index.ts';
export { PLUGIN_MANIFEST as FolderPluginManifest } from './plugin-manifest.ts';

// Export plugin definition for worker consumption
// Plugin definition export removed: metadata is sourced from package.json

// Export BaseDialogPlugin for dialog-based extensions
export * from './common/base/BaseDialogPlugin.ts';
export * from './common/base/BaseFolderPlugin.ts';

// Convenience initializer to register common extensions
export { initializeDefaultFolderExtensions, initializeDefaultNodeDialogExtensions } from './common/init/register-default-extensions.ts';

// Optional runtime wiring (no-op for folder plugin)
export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    // Runtime worker adapters are optional; default behaviour covers folder nodes.
  }
}
