export interface PluginManifestDatabasePrewarmEntry {
  export?: string;
  exportName?: string;
  specifier?: string;
  module?: string;
}

export type PluginManifestDatabasePrewarmConfig =
  | string
  | PluginManifestDatabasePrewarmEntry
  | Array<string | PluginManifestDatabasePrewarmEntry>;
