// No DB/handler exports; CoreDB.nodes is the source of truth.

// Basic components
// UI components moved to subpath export to keep root worker-safe

// Export types
export * from './common/types/FolderEntity.js';
export * from './common/types/types.js';
export { PLUGIN_MANIFEST as FolderPluginManifest } from './plugin-manifest.js';

// UI host is exposed via ./ui; no legacy dialog exports.
