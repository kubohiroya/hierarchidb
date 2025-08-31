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
 * パッケージ検出戦略
 */
export interface PackageDetectionStrategy {
  /** 戦略の名前 */
  name: string;
  /** パッケージが対象かどうかを判定 */
  test: (packageName: string, packageJson: PackageJson) => boolean;
  /** 優先順位の決定 */
  getPriority?: (packageName: string, packageJson: PackageJson) => number;
  /** メタデータの抽出 */
  extractMetadata?: (packageJson: PackageJson) => Record<string, any>;
}

/**
 * 変換パイプラインオプション
 */
export interface TransformPipelineOptions<T = any> {
  /** パッケージ情報を任意の形式に変換 */
  transform: (packages: Map<string, PackageJson>) => T;
  /** 依存関係の解決 */
  resolveDependencies?: (item: T) => string[];
  /** ソート戦略 */
  sort?: (items: T[]) => T[];
}

/**
 * Virtual Module生成器
 */
export interface VirtualModuleGenerator<T = any> {
  /** Virtual ModuleのID */
  moduleId: string;
  /** モジュールコンテンツの生成 */
  generate: (data: T) => string;
  /** TypeScript定義の生成 */
  generateTypes?: (data: T) => string;
}

/**
 * フック定義
 */
export interface Hooks<T = any> {
  /** パッケージ検出前 */
  beforeDetection?: () => Promise<void> | void;
  /** パッケージ検出後 */
  afterDetection?: (packages: Map<string, PackageJson>) => Promise<void> | void;
  /** 変換前 */
  beforeTransform?: (packages: Map<string, PackageJson>) => Promise<Map<string, PackageJson>> | Map<string, PackageJson>;
  /** 変換後 */
  afterTransform?: (result: T) => Promise<T> | T;
  /** エラーハンドリング */
  onError?: (error: Error, context: string) => void;
}

/**
 * モノレポサポート設定
 */
export interface MonorepoOptions {
  /** パッケージディレクトリのパス */
  packages?: string[];
  /** ワークスペースプロトコルの解決 */
  resolveWorkspace?: boolean;
  /** pnpm workspace.yaml の使用 */
  usePnpmWorkspace?: boolean;
  /** lerna.json の使用 */
  useLerna?: boolean;
}

/**
 * ログレベル
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/**
 * ロガー設定
 */
export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  colors?: boolean;
}

/**
 * プラグインオプション
 */
export interface VitePluginPackageReaderOptions<T = any> {
  /** 基本設定 */
  rootDir?: string;
  verbose?: boolean;
  cache?: boolean;
  watch?: boolean;

  /** ロガー設定 */
  logger?: LoggerOptions;

  /** 検出戦略 */
  strategies: PackageDetectionStrategy[];

  /** 変換パイプライン */
  pipeline?: TransformPipelineOptions<T>;

  /** Virtual Module生成 */
  virtualModules?: VirtualModuleGenerator<T>[];

  /** フック */
  hooks?: Hooks<T>;

  /** モノレポサポート */
  monorepo?: MonorepoOptions;
}

/**
 * プラグインAPI
 */
export interface VitePluginPackageReaderAPI<T = any> {
  /** 検出されたパッケージを取得 */
  getPackages(): Map<string, PackageJson>;
  /** 変換結果を取得 */
  getTransformed(): T | undefined;
  /** キャッシュをクリア */
  clearCache(): void;
  /** パッケージを再読み込み */
  reload(): Promise<void>;
}

/**
 * 拡張Viteプラグイン型
 */
export interface VitePluginWithAPI<T = any> extends Plugin {
  api?: VitePluginPackageReaderAPI<T>;
}