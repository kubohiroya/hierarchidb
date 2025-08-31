/**
 * package.jsonベースのプラグイン探索戦略
 */

import { NodeType } from '@hierarchidb/common-type';
import {
  BasePluginDiscoveryStrategy,
  PluginManifest,
  DiscoveryOptions,
} from './PluginDiscoveryStrategy';

/**
 * package.jsonからプラグインを探索する戦略
 */
export class PackageJsonDiscoveryStrategy extends BasePluginDiscoveryStrategy {
  
  constructor(options: DiscoveryOptions = {}) {
    super({
      packagePattern: /@hierarchidb\/node-type-.+-plugin/,
      ...options,
    });
  }
  
  async discover(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];
    
    try {
      // 既知のプラグインパッケージリスト
      const knownPlugins = [
        'folder',
        'shape',
        'location',
        'route',
        'spreadsheet',
        'basemap',
        'stylemap',
        'project',
        'propertyresolver',
      ];
      
      for (const pluginName of knownPlugins) {
        const manifest = await this.loadPluginManifest(pluginName);
        if (manifest) {
          manifests.push(manifest);
        }
      }
      
    } catch (error) {
      console.error('Failed to discover plugins:', error);
    }
    
    return manifests;
  }
  
  async discoverByNodeType(nodeType: NodeType): Promise<PluginManifest | null> {
    try {
      return await this.loadPluginManifest(nodeType);
    } catch (error) {
      this.log(`Failed to discover plugin for ${nodeType}:`, error);
      return null;
    }
  }
  
  getName(): string {
    return 'PackageJsonDiscoveryStrategy';
  }
  
  /**
   * プラグインマニフェストをロード
   */
  private async loadPluginManifest(pluginName: string): Promise<PluginManifest | null> {
    const packageName = `@hierarchidb/${pluginName}-plugin`;
    
    try {
      // package.jsonを動的インポート
      const packageJson = await import(`${packageName}/package.json`);
      
      // マニフェストを構築
      const manifest: PluginManifest = {
        nodeType: pluginName as NodeType,
        packageName,
        packagePath: packageName,
        version: packageJson.version || '1.0.0',
        dependencies: this.extractDependencies(packageJson),
        metadata: {
          displayName: this.formatDisplayName(pluginName),
          description: packageJson.description,
          author: packageJson.author,
          license: packageJson.license,
        },
        rawPackageJson: packageJson,
      };
      
      this.log(`Loaded manifest for ${packageName}`);
      return manifest;
      
    } catch (error) {
      // パッケージが見つからない場合は静的定義を使用
      return this.createStaticManifest(pluginName);
    }
  }
  
  /**
   * 静的マニフェストを作成（フォールバック）
   */
  private createStaticManifest(pluginName: string): PluginManifest | null {
    const staticDefinitions: Record<string, Partial<PluginManifest>> = {
      folder: {
        metadata: {
          displayName: 'Folder',
          description: 'Container for organizing items',
        },
        dependencies: [],
      },
      shape: {
        metadata: {
          displayName: 'Shape',
          description: 'Geometric shape element',
        },
        dependencies: ['folder'],
      },
      location: {
        metadata: {
          displayName: 'Location',
          description: 'Geographic location marker',
        },
        dependencies: ['folder'],
      },
      route: {
        metadata: {
          displayName: 'Route',
          description: 'Path between locations',
        },
        dependencies: ['location'],
      },
      spreadsheet: {
        metadata: {
          displayName: 'Spreadsheet',
          description: 'Tabular data editor',
        },
        dependencies: ['folder'],
      },
      basemap: {
        metadata: {
          displayName: 'Base Map',
          description: 'Map layer configuration',
        },
        dependencies: ['folder'],
      },
      stylemap: {
        metadata: {
          displayName: 'Style Map',
          description: 'Visual style mapping',
        },
        dependencies: ['basemap'],
      },
      project: {
        metadata: {
          displayName: 'Project',
          description: 'Project container',
        },
        dependencies: ['folder'],
      },
      propertyresolver: {
        metadata: {
          displayName: 'Property Resolver',
          description: 'Dynamic property resolution',
        },
        dependencies: [],
      },
    };
    
    const staticDef = staticDefinitions[pluginName];
    if (!staticDef) return null;
    
    return {
      nodeType: pluginName as NodeType,
      packageName: `@hierarchidb/${pluginName}-plugin`,
      packagePath: `@hierarchidb/${pluginName}-plugin`,
      version: '1.0.0',
      dependencies: staticDef.dependencies || [],
      metadata: staticDef.metadata || {},
    };
  }
  
  /**
   * package.jsonから依存関係を抽出
   */
  private extractDependencies(packageJson: any): string[] {
    const deps: string[] = [];
    
    // 他のプラグインへの依存を探す
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.peerDependencies,
    };
    
    for (const dep in allDeps) {
      const nodeType = this.extractNodeType(dep);
      if (nodeType && dep !== packageJson.name) {
        deps.push(nodeType);
      }
    }
    
    return deps;
  }
  
  /**
   * プラグイン名を表示名にフォーマット
   */
  private formatDisplayName(pluginName: string): string {
    return pluginName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}