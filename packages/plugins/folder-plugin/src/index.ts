// No DB/handler exports; CoreDB.nodes is the source of truth.

// Basic components
// UI components moved to subpath export to keep root worker-safe

// Export types
export * from './types/index.js';
export * from './entities/FolderEntity.js';

// Export plugin definition for worker consumption
// Plugin definition export removed: metadata is sourced from package.json

// Export BaseDialogPlugin for dialog-based extensions
export * from './base/BaseDialogPlugin.js';
export { wrapDialogStepComponent } from './base/wrapDialogStepComponent.js';

// Convenience initializer to register common extensions
export { initializeDefaultFolderExtensions, initializeDefaultNodeDialogExtensions } from './init/register-default-extensions.js';

// Optional runtime wiring (no-op for folder plugin)
import { registerRuntimeWorkerNotImplemented } from '@hierarchidb/plugins-runtime-worker-factory';

export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    registerRuntimeWorkerNotImplemented('folder', '[folder-plugin] runtime worker integration is not implemented yet');
  }
}
