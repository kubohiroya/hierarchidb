export type PluginSpecifierMode = 'package' | 'dist-url';

export interface NormalizedDatabasePrewarmEntry {
  export: string;
  specifier?: string;
}

export interface DatabasePrewarmTarget {
  exportName: string;
  specifier: string;
}

export interface ManifestSummary {
  manifest: Record<string, unknown>;
  nodeType: string;
  packageName: string;
  packageVersion: string;
  dependencies: string[];
  hasUI: boolean;
  hasWorker: boolean;
  hasDatabaseModule: boolean;
  hasCommon: boolean;
  exportPaths: string[];
  uiSourceEntry: string | null;
  workerSourceEntry: string | null;
  databaseSourceEntry: string | null;
  commonSourceEntry: string | null;
  rootDistEntry: string | null;
  uiDistEntry: string | null;
  workerDistEntry: string | null;
  databaseDistEntry: string | null;
  commonDistEntry: string | null;
  iconComponent?: {
    specifier: string;
    exportName?: string;
    sourceEntry?: string | null;
    distEntry?: string | null;
  };
  workerPreloadExports: string[];
  databaseModuleSpecifier: string | null;
  databasePrewarmTargets: DatabasePrewarmTarget[];
}

export type GeneratePluginRegistryOptions = {
  mode?: PluginSpecifierMode;
};
