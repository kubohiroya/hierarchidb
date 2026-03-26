// No DB/handler exports; CoreDB.nodes is the source of truth.

// Basic components
// UI components moved to subpath export to keep root worker-safe

// Export types
export * from './common/types/index.js';
export { PLUGIN_MANIFEST as FolderPluginManifest } from './plugin-manifest.js';

// YAML snapshot utilities (used by simulation-workflow and other consumers)
export type { ExportableNode, YamlExportResult } from './common/shared/yamlFolderExport.js';
export { exportYamlNodesToSnapshot } from './common/shared/yamlFolderExport.js';
export type { YamlImportResult } from './common/shared/yamlFolderImport.js';
export { importYamlNodesFromSnapshot } from './common/shared/yamlFolderImport.js';

// UI host is exposed via ./ui; no legacy dialog exports.
