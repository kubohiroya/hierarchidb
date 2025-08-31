/**
 * プラグイン探索戦略のインターフェース（Strategy Pattern）
 */

import { NodeType } from '@hierarchidb/common-type';

/**
 * 探索されたプラグインのマニフェスト情報
 */
export interface PluginManifest {
  nodeType: NodeType;
  packageName: string;
  packagePath: string;
  version: string;
  dependencies: string[];
  metadata: {
    displayName?: string;
    description?: string;
    author?: string;
    license?: string;
  };
  // package.jsonの生データ
  rawPackageJson?: any;
}

/**
 * プラグイン探索戦略インターフェース
 */
export interface IPluginDiscoveryStrategy {
  /**
   * プラグインを探索する
   */
  discover(): Promise<PluginManifest[]>;
  
  /**
   * 特定のプラグインを探索する
   */
  discoverByNodeType(nodeType: NodeType): Promise<PluginManifest | null>;
  
  /**
   * 探索戦略の名前
   */
  getName(): string;
}

/**
 * 探索オプション
 */
export interface DiscoveryOptions {
  /** 探索するディレクトリ */
  searchPaths?: string[];
  
  /** 除外するパッケージ */
  excludePackages?: string[];
  
  /** パッケージ名のパターン */
  packagePattern?: RegExp;
  
  /** デバッグモード */
  debug?: boolean;
}

/**
 * 抽象基底クラス
 */
export abstract class BasePluginDiscoveryStrategy implements IPluginDiscoveryStrategy {
  constructor(protected options: DiscoveryOptions = {}) {}
  
  abstract discover(): Promise<PluginManifest[]>;
  abstract discoverByNodeType(nodeType: NodeType): Promise<PluginManifest | null>;
  abstract getName(): string;
  
  /**
   * パッケージ名からNodeTypeを抽出
   */
  protected extractNodeType(packageName: string): NodeType | null {
    const pattern = /@hierarchidb\/node-type-(.+)-plugin/;
    const match = packageName.match(pattern);
    return match ? (match[1] as NodeType) : null;
  }
  
  /**
   * デバッグログ出力
   */
  protected log(message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`[${this.getName()}] ${message}`, ...args);
    }
  }
}