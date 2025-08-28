import { PluginManifest } from './plugin-manifest';

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
