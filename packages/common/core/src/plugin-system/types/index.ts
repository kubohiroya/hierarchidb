/**
 * Plugin system type definitions
 * 
 * This module consolidates all plugin-related types to eliminate duplication
 * and provide a single source of truth for plugin system interfaces.
 */

// Core plugin manifest
export type { PluginManifest } from './PluginManifest';

// Discovery and loading types
export type {
  PackageJson,
  PluginDiscoveryResult,
  PluginLoadResult,
  PluginLoadEntry,
  LoadingResult,
  PluginAvailability
} from './DiscoveryTypes';



// Registry and dependency resolution types
export type {
  PluginMetadata,
  ResolutionResult,
  ResolvedPlugin,
  DependencyGraph,
  DependencyError,
  PluginRegistrationConfig
} from './RegistryTypes';