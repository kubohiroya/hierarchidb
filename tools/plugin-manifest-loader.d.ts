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

