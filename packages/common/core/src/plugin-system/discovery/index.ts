/**
 * Plugin discovery utilities
 * 
 * This module provides different strategies for discovering plugins:
 * - PackageJsonDiscovery: Uses package.json dependencies only
 * - ManifestFileDiscovery: Uses plugin manifest files with enhanced metadata
 * - PluginMetadataValidator: Validates plugin metadata consistency
 */

// Package.json based discovery
export { PackageJsonDiscovery } from './PackageJsonDiscovery';

// Manifest file based discovery
export { ManifestFileDiscovery, manifestFileDiscovery } from './ManifestFileDiscovery';

// Plugin metadata validation
export {
  PluginMetadataValidator,
  type ValidationResult,
  type ValidationReport
} from './PluginMetadataValidator';