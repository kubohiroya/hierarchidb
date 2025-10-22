/**
 * Type declarations for `tools/plugin-manifest-loader.js`. Consumers import
 * these helpers from build scripts to evaluate plugin manifests during
 * generation steps (e.g., `scripts/generate-plugin-loader.mjs`).
 */
export interface ManifestLoaderOptions {
  silent?: boolean;
}

export interface PackageJsonLike {
  __path?: string;
  [key: string]: unknown;
}

export type PluginManifest = Record<string, unknown> | undefined;

export function loadPluginManifestFromFile(manifestPath: string, options?: ManifestLoaderOptions): PluginManifest;

export function loadPluginManifestFromPackageJson(pkg: PackageJsonLike, options?: ManifestLoaderOptions): PluginManifest;

export function resolvePluginManifestPath(pkg: PackageJsonLike): string | undefined;
