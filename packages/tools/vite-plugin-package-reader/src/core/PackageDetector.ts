import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import type { 
  PackageJson, 
  PackageDetectionStrategy, 
  MonorepoOptions 
} from '../types';
import { Logger } from './Logger';
import { PackageCache } from './PackageCache';

export interface PackageDetectorOptions {
  rootDir?: string;
  cache?: boolean;
  cacheTTL?: number;
  logger?: Logger;
  monorepo?: MonorepoOptions;
}

export class PackageDetector {
  private rootDir: string;
  private cache: PackageCache | null;
  private logger: Logger;
  private monorepo: MonorepoOptions;

  constructor(options: PackageDetectorOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.cache = options.cache !== false ? new PackageCache(options.cacheTTL) : null;
    this.logger = options.logger || new Logger();
    this.monorepo = options.monorepo || {};
  }

  /**
   * パッケージを検出
   */
  async detect(strategies: PackageDetectionStrategy[]): Promise<Map<string, PackageJson>> {
    this.logger.info('Starting package detection...');
    
    // すべてのpackage.jsonを見つける
    const packagePaths = await this.findPackageJsonPaths();
    this.logger.debug(`Found ${packagePaths.length} package.json files`);

    const results = new Map<string, PackageJson>();

    for (const packagePath of packagePaths) {
      const packageJson = await this.readPackageJson(packagePath);
      if (!packageJson) continue;

      // 戦略に基づいてフィルタリング
      for (const strategy of strategies) {
        if (strategy.test(packageJson.name, packageJson)) {
          this.logger.debug(`Strategy "${strategy.name}" matched package "${packageJson.name}"`);
          
          // メタデータを抽出
          if (strategy.extractMetadata) {
            const metadata = strategy.extractMetadata(packageJson);
            packageJson.__metadata = { ...packageJson.__metadata, ...metadata };
          }

          // 優先度を設定
          if (strategy.getPriority) {
            const priority = strategy.getPriority(packageJson.name, packageJson);
            packageJson.__priority = priority;
          }

          results.set(packageJson.name, packageJson);
          break; // 最初にマッチした戦略を使用
        }
      }
    }

    this.logger.info(`Detected ${results.size} packages`);
    return this.sortByPriority(results);
  }

  /**
   * package.jsonファイルのパスを検索
   */
  private async findPackageJsonPaths(): Promise<string[]> {
    const paths: string[] = [];

    // ルートのpackage.json
    const rootPackageJson = path.join(this.rootDir, 'package.json');
    if (await this.fileExists(rootPackageJson)) {
      paths.push(rootPackageJson);
    }

    // appディレクトリ
    const appPackageJson = path.join(this.rootDir, 'app', 'package.json');
    if (await this.fileExists(appPackageJson)) {
      paths.push(appPackageJson);

      // app/node_modules内のパッケージ
      const nodeModulesPath = path.join(this.rootDir, 'app', 'node_modules');
      if (await this.dirExists(nodeModulesPath)) {
        const nodeModulesPaths = await glob('*/package.json', {
          cwd: nodeModulesPath,
          absolute: true,
        });
        paths.push(...nodeModulesPaths);

        // スコープ付きパッケージ
        const scopedPaths = await glob('@*/*/package.json', {
          cwd: nodeModulesPath,
          absolute: true,
        });
        paths.push(...scopedPaths);
      }
    }

    // モノレポのパッケージ
    if (this.monorepo.packages) {
      for (const packagePattern of this.monorepo.packages) {
        const pattern = path.join(this.rootDir, packagePattern, 'package.json');
        const monoPaths = await glob(pattern, { absolute: true });
        paths.push(...monoPaths);
      }
    }

    // pnpm workspace
    if (this.monorepo.usePnpmWorkspace) {
      const workspacePaths = await this.readPnpmWorkspace();
      for (const workspacePath of workspacePaths) {
        const pattern = path.join(this.rootDir, workspacePath, 'package.json');
        const pnpmPaths = await glob(pattern, { absolute: true });
        paths.push(...pnpmPaths);
      }
    }

    return [...new Set(paths)]; // 重複を削除
  }

  /**
   * package.jsonを読み込む
   */
  private async readPackageJson(filePath: string): Promise<PackageJson | null> {
    // キャッシュチェック
    if (this.cache && this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const packageJson = JSON.parse(content) as PackageJson;
      
      // パスを追加
      packageJson.__path = filePath;
      
      // キャッシュに保存
      if (this.cache) {
        this.cache.set(filePath, packageJson);
      }

      return packageJson;
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        this.logger.error(`Failed to read ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * pnpm-workspace.yamlを読み込む
   */
  private async readPnpmWorkspace(): Promise<string[]> {
    const workspacePath = path.join(this.rootDir, 'pnpm-workspace.yaml');
    try {
      const content = await fs.readFile(workspacePath, 'utf-8');
      // 簡易的なYAMLパース
      const lines = content.split('\n');
      const packages: string[] = [];
      let inPackages = false;

      for (const line of lines) {
        if (line.trim() === 'packages:') {
          inPackages = true;
          continue;
        }
        if (inPackages && line.startsWith('  - ')) {
          const pkg = line.replace('  - ', '').replace(/['"]/g, '').trim();
          packages.push(pkg);
        } else if (inPackages && !line.startsWith(' ')) {
          break;
        }
      }

      return packages;
    } catch {
      return [];
    }
  }

  /**
   * ファイルの存在確認
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * ディレクトリの存在確認
   */
  private async dirExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 優先度でソート
   */
  private sortByPriority(packages: Map<string, PackageJson>): Map<string, PackageJson> {
    const entries = Array.from(packages.entries());
    entries.sort((a, b) => {
      const priorityA = a[1].__priority ?? 1000;
      const priorityB = b[1].__priority ?? 1000;
      return priorityA - priorityB;
    });
    return new Map(entries);
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
      this.logger.debug('Cache cleared');
    }
  }

  /**
   * キャッシュの統計情報を取得
   */
  getCacheStats(): any {
    if (!this.cache) {
      return null;
    }
    return this.cache.getStats();
  }
}