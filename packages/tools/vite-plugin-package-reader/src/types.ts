import type { Plugin } from 'vite';

export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  module?: string;
  types?: string;
  exports?: any;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  [key: string]: any;
}

/**
    */
export interface PackageDetectionStrategy {
  /**
      */
  name: string;
  /**
      */
  test: (packageName: string, packageJson: PackageJson) => boolean;
  /**
      */
  getPriority?: (packageName: string, packageJson: PackageJson) => number;
  /**
      */
  extractMetadata?: (packageJson: PackageJson) => Record<string, any>;
}

/**
    */
export interface TransformPipelineOptions<T = any> {
  /**
      */
  transform: (packages: Map<string, PackageJson>) => T;
  /**
      */
  resolveDependencies?: (item: T) => string[];
  /**
      */
  sort?: (items: T[]) => T[];
}

/**
  * Virtual Module
  */
export interface VirtualModuleGenerator<T = any> {
  /**
   * Virtual ModuleID
   */
  moduleId: string;
  /**
      */
  generate: (data: T) => string;
  /**
   * TypeScript
   */
  generateTypes?: (data: T) => string;
}

/**
    */
export interface Hooks<T = any> {
  /**
      */
  beforeDetection?: () => Promise<void> | void;
  /**
      */
  afterDetection?: (packages: Map<string, PackageJson>) => Promise<void> | void;
  /**
      */
  beforeTransform?: (packages: Map<string, PackageJson>) => Promise<Map<string, PackageJson>> | Map<string, PackageJson>;
  /**
      */
  afterTransform?: (result: T) => Promise<T> | T;
  /**
      */
  onError?: (error: Error, context: string) => void;
}

/**
    */
export interface MonorepoOptions {
  /**
      */
  packages?: string[];
  /**
      */
  resolveWorkspace?: boolean;
  /**
   * pnpm workspace.yaml
   */
  usePnpmWorkspace?: boolean;
  /**
   * lerna.json
   */
  useLerna?: boolean;
}

/**
    */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/**
    */
export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  colors?: boolean;
}

/**
    */
export interface VitePluginPackageReaderOptions<T = any> {
  /**
      */
  rootDir?: string;
  verbose?: boolean;
  cache?: boolean;
  watch?: boolean;

  /**
      */
  logger?: LoggerOptions;

  /**
      */
  strategies: PackageDetectionStrategy[];

  /**
      */
  pipeline?: TransformPipelineOptions<T>;

  /**
   * Virtual Module
   */
  virtualModules?: VirtualModuleGenerator<T>[];

  /**
      */
  hooks?: Hooks<T>;

  /**
      */
  monorepo?: MonorepoOptions;
}

/**
  * API
  */
export interface VitePluginPackageReaderAPI<T = any> {
  /**
      */
  getPackages(): Map<string, PackageJson>;

  /**
      */
  getTransformed(): T | undefined;

  /**
      */
  clearCache(): void;

  /**
      */
  reload(): Promise<void>;
}

/**
  * Vite
  */
export interface VitePluginWithAPI<T = any> extends Plugin {
  api?: VitePluginPackageReaderAPI<T>;
}