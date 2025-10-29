export interface DevAliasConfigFile {
  readonly packages?: string[];
  readonly groups?: string[];
  readonly plugins?: string[];
}

export interface DevAliasSelection {
  readonly packages: Set<string>;
  readonly groups: Set<string>;
  readonly plugins: Set<string>;
  readonly allPackages: boolean;
  readonly allPlugins: boolean;
}

export interface WorkspacePackageMeta {
  readonly name: string;
  readonly dir: string;
  readonly relativeDir: string;
  readonly category: 'packages' | 'plugins';
  readonly group: string;
  readonly srcEntry: string | null;
  readonly srcDir: string | null;
  readonly distEntry: string | null;
  readonly distDir: string | null;
  readonly typesEntry: string | null;
}

export declare const EMPTY_DEV_ALIAS_SELECTION: DevAliasSelection;

export declare function loadDevAliasConfig(repoRoot: string): DevAliasConfigFile;

export declare function parseDevAliasOverride(
  overrideRaw: string | undefined,
  base: DevAliasConfigFile,
): DevAliasConfigFile;

export declare function createDevAliasSelection(config: DevAliasConfigFile): DevAliasSelection;

export declare function cloneEmptySelection(): DevAliasSelection;

export declare function shouldUseSource(
  selection: DevAliasSelection,
  specifier: string,
  group?: string | null,
): boolean;

export declare function shouldUsePluginSource(
  selection: DevAliasSelection,
  packageName: string,
  nodeType?: string | null,
): boolean;

export declare function toPosixRelative(from: string, to: string): string;

export declare function collectWorkspacePackages(repoRoot: string): WorkspacePackageMeta[];
