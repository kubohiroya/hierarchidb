import type { NodeType } from '../../types';
import type { PluginManifest } from './PluginManifest';

/**
 * Package.json structure for plugin discovery
 */
export interface PackageJson {
  /** Package name */
  name: string;
  /** Runtime dependencies */
  dependencies?: Record<string, string>;
  /** Development dependencies */
  devDependencies?: Record<string, string>;
  /** Plugin-specific configuration */
  hierarchidb?: {
    plugin?: Partial<PluginManifest>;
  };
}

/**
 * Result of plugin discovery process
 */
export interface PluginDiscoveryResult {
  /** Plugins directly requested/listed in app's package.json */
  requestedPlugins: NodeType[];
  /** All plugins including transitive dependencies */
  allPlugins: NodeType[];
  /** Load order respecting dependencies */
  loadOrder: NodeType[];
  /** Dependency graph mapping */
  dependencyGraph: Record<NodeType, NodeType[]>;
}

/**
 * Result of plugin loading with dependencies
 */
export interface PluginLoadResult {
  /** All discovered plugins */
  plugins: NodeType[];
  /** Resolved load order */
  loadOrder: NodeType[];
  /** Plugin manifests mapping */
  manifests: Record<NodeType, PluginManifest>;
}

/**
 * Individual plugin load result
 */
export interface PluginLoadEntry {
  /** Plugin identifier */
  nodeType: NodeType;
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Loaded module */
  module: any;
  /** Time taken to load (ms) */
  loadTime: number;
  /** How this plugin was included */
  source: 'requested' | 'dependency' | 'optional';
  /** Chain of dependencies leading to this plugin */
  dependencyChain: NodeType[];
}

/**
 * Complete loading operation result
 */
export interface LoadingResult {
  /** Whether loading was successful */
  success: boolean;
  /** Originally requested plugins */
  requested: NodeType[];
  /** Successfully loaded plugins */
  loaded: PluginLoadEntry[];
  /** Plugins that were skipped */
  skipped: NodeType[];
  /** Plugins that failed to load */
  failed: Array<{
    nodeType: NodeType;
    error: string;
  }>;
  /** Final load order used */
  loadOrder: NodeType[];
  /** Total loading time (ms) */
  totalTime: number;
  /** Dependency graph data */
  dependencyGraph: any;
}

/**
 * Plugin availability check result
 */
export interface PluginAvailability {
  /** Plugin identifier */
  nodeType: NodeType;
  /** Whether plugin is available */
  available: boolean;
  /** Package name that would be imported */
  packageName: string;
  /** Reason if not available */
  reason?: string;
}