export type PluginEntryKind = 'ui' | 'worker' | 'database' | 'common' | 'root';

export interface PluginSubpathInfo {
  readonly kind: PluginEntryKind;
  readonly exportKey: string;
  readonly sourcePath: string | null;
  readonly hasExport: boolean;
}

export interface NodeTypePluginDetails {
  readonly nodeType: string;
  readonly packageName: string;
  readonly version: string | null;
  readonly packageDir: string;
  readonly packageJsonPath: string;
  readonly manifestPath: string | null;
  readonly exportsField: Record<string, unknown> | string | undefined;
  readonly subpaths: Record<PluginEntryKind, PluginSubpathInfo>;
}

export interface DetectPluginsOptions {
  readonly rootDir: string;
  readonly manifestFallback?: boolean;
}

export interface AliasEntry {
  readonly find: string;
  readonly replacement: string;
  readonly kind: PluginEntryKind;
  readonly nodeType: string;
  readonly packageName: string;
}

export interface CreateAliasPluginOptions {
  readonly rootDir?: string;
  readonly tsconfigPath?: string;
  readonly kinds?: PluginEntryKind[];
  readonly tsconfigKinds?: PluginEntryKind[];
}

export interface CreateRegistryPluginOptions {
  readonly rootDir?: string;
  readonly debugSnapshotDir?: string;
  readonly minimal?: boolean;
}

export interface PluginManifestShape {
  readonly nodeType?: string;
  readonly dependencies?: string[];
  readonly priority?: number;
}

export interface PluginRegistryEntry {
  readonly nodeType: string;
  readonly packageName: string;
  readonly version: string | null;
  readonly hasUI: boolean;
  readonly hasWorker: boolean;
  readonly hasCommon: boolean;
  readonly manifest: PluginManifestShape | null;
}
