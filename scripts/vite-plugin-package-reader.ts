import { Plugin } from 'vite';
import fs from 'fs/promises';
import path from 'path';

export interface PackageJsonContent {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  hierarchidb?: {
    plugin?: any;
  };
}

export interface PackageReaderOptions {
  rootDir?: string;
  pluginPattern?: RegExp;
}

export class PackageJsonReader {
  private cache = new Map<string, PackageJsonContent>();
  private rootDir: string;
  private pluginPattern: RegExp;

  constructor(options: PackageReaderOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.pluginPattern = options.pluginPattern || /@hierarchidb\/node-type-.*-plugin$/;
  }

  /**
   * アプリケーションのpackage.jsonを読み込む
   */
  async readAppPackageJson(): Promise<PackageJsonContent> {
    const appPackageJsonPath = path.join(this.rootDir, 'app', 'package.json');
    const content = await this.readPackageJson(appPackageJsonPath);
    if (!content) {
      throw new Error(`Failed to read app package.json from ${appPackageJsonPath}`);
    }
    return content;
  }

  /**
   * プラグインパッケージを検出する
   */
  detectPluginPackages(dependencies: Record<string, string>): string[] {
    const pluginPackages = Object.keys(dependencies)
      .filter(name => this.pluginPattern.test(name))
      .sort((a, b) => {
        // folder-pluginを優先
        if (a.includes('folder-plugin')) return -1;
        if (b.includes('folder-plugin')) return 1;
        return a.localeCompare(b);
      });
    
    return pluginPackages;
  }

  /**
   * プラグインのpackage.jsonを読み込む
   */
  async readPluginPackageJson(packageName: string): Promise<PackageJsonContent | null> {
    // キャッシュチェック
    if (this.cache.has(packageName)) {
      return this.cache.get(packageName)!;
    }

    // node_modulesから探す
    let packageJsonPath = path.join(this.rootDir, 'app', 'node_modules', packageName, 'package.json');
    let content = await this.readPackageJson(packageJsonPath);

    // モノレポ構造の場合
    if (!content) {
      const pluginType = packageName.replace('@hierarchidb/node-type-', '').replace('-plugin', '');
      packageJsonPath = path.join(this.rootDir, 'packages', 'node-type', pluginType, 'package.json');
      content = await this.readPackageJson(packageJsonPath);
    }

    if (content) {
      this.cache.set(packageName, content);
    } else {
      console.warn(`[PackageReader] Could not find package.json for ${packageName}`);
    }

    return content;
  }

  /**
   * すべてのプラグインpackage.jsonを読み込む
   */
  async readAllPluginPackages(): Promise<Map<string, PackageJsonContent>> {
    console.log('[PackageReader] Reading plugin package.json files...');
    
    const appPackageJson = await this.readAppPackageJson();
    const dependencies = appPackageJson.dependencies || {};
    const pluginPackages = this.detectPluginPackages(dependencies);
    
    console.log(`[PackageReader] Found ${pluginPackages.length} plugin packages`);
    
    const results = new Map<string, PackageJsonContent>();
    
    for (const packageName of pluginPackages) {
      const content = await this.readPluginPackageJson(packageName);
      if (content) {
        results.set(packageName, content);
        console.log(`[PackageReader] Loaded ${packageName} v${content.version}`);
      }
    }
    
    return results;
  }

  /**
   * package.jsonファイルを読み込む
   */
  private async readPackageJson(filePath: string): Promise<PackageJsonContent | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as PackageJsonContent;
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error(`[PackageReader] Error reading ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * キャッシュを取得する
   */
  getCache(): Map<string, PackageJsonContent> {
    return new Map(this.cache);
  }
}

/**
 * Viteプラグイン
 */
export function vitePluginPackageReader(options?: PackageReaderOptions): Plugin {
  const reader = new PackageJsonReader(options);
  let pluginPackages: Map<string, PackageJsonContent>;

  return {
    name: 'vite-plugin-package-reader',
    
    async buildStart() {
      pluginPackages = await reader.readAllPluginPackages();
    },
    
    // APIを公開
    api: {
      getReader(): PackageJsonReader {
        return reader;
      },
      getPluginPackages(): Map<string, PackageJsonContent> {
        return pluginPackages || new Map();
      }
    }
  };
}