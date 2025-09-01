/**
 * プラグイン定義のファクトリー（Factory Pattern）
 */

import { PluginDefinition, NodeType } from '@hierarchidb/common-type';
import { PluginManifest } from '../1-discovery/PluginDiscoveryStrategy';

/**
 * プラグイン定義ファクトリーインターフェース
 */
export interface IPluginDefinitionFactory {
  /**
   * マニフェストからプラグイン定義を作成
   */
  createFromManifest(manifest: PluginManifest): Promise<PluginDefinition>;
  
  /**
   * JSONデータからプラグイン定義を作成
   */
  createFromJson(json: any): Promise<PluginDefinition>;
  
  /**
   * バッチ作成
   */
  createBatch(manifests: PluginManifest[]): Promise<Map<NodeType, PluginDefinition>>;
}

/**
 * プラグイン定義ファクトリー実装
 */
export class PluginDefinitionFactory implements IPluginDefinitionFactory {
  private builder: PluginDefinitionBuilder;
  private validator: PluginDefinitionValidator;
  
  constructor() {
    this.builder = new PluginDefinitionBuilder();
    this.validator = new PluginDefinitionValidator();
  }
  
  async createFromManifest(manifest: PluginManifest): Promise<PluginDefinition> {
    // ビルダーパターンで定義を構築
    const definition = await this.builder
      .reset()
      .setNodeType(manifest.nodeType)
      .setBasicInfo(manifest.metadata.displayName || manifest.nodeType, manifest.metadata.description)
      .setPackageInfo(manifest.packageName, manifest.version)
      .setDependencies(manifest.dependencies)
      .setDatabaseConfig(manifest.nodeType)
      .setDefaultIcon(manifest.nodeType)
      .build();
    
    // バリデーション
    this.validator.validate(definition);
    
    return definition;
  }
  
  async createFromJson(json: any): Promise<PluginDefinition> {
    const definition = await this.builder
      .reset()
      .fromJson(json)
      .build();
    
    this.validator.validate(definition);
    
    return definition;
  }
  
  async createBatch(manifests: PluginManifest[]): Promise<Map<NodeType, PluginDefinition>> {
    const definitions = new Map<NodeType, PluginDefinition>();
    
    for (const manifest of manifests) {
      try {
        const definition = await this.createFromManifest(manifest);
        definitions.set(definition.nodeType, definition);
      } catch (error) {
        console.error(`Failed to create definition for ${manifest.nodeType}:`, error);
      }
    }
    
    return definitions;
  }
}

/**
 * プラグイン定義ビルダー（Builder Pattern）
 */
export class PluginDefinitionBuilder {
  private definition: Partial<PluginDefinition> = {};
  
  reset(): this {
    this.definition = {
      dependencies: [],
      priority: 0,
      version: '1.0.0',
    };
    return this;
  }
  
  setNodeType(nodeType: NodeType): this {
    this.definition = {
      ...this.definition,
      nodeType,
      name: nodeType,
    };
    return this;
  }
  
  setBasicInfo(displayName: string, description?: string): this {
    this.definition = {
      ...this.definition,
      displayName,
      description,
    };
    return this;
  }
  
  setPackageInfo(_packageName: string, version: string): this {
    this.definition = {
      ...this.definition,
      version,
    };
    return this;
  }
  
  setDependencies(dependencies: string[]): this {
    this.definition = {
      ...this.definition,
      dependencies,
    };
    return this;
  }
  
  setDatabaseConfig(nodeType: NodeType): this {
    this.definition = {
      ...this.definition,
      database: {
        dbName: `${nodeType}-db`,
        schema: {
          [`${nodeType}s`]: '++id, nodeId, name, createdAt, updatedAt',
        },
        version: 1,
      },
    };
    return this;
  }
  
  setDefaultIcon(nodeType: NodeType): this {
    // デフォルトアイコンマッピング
    const iconMap: Record<string, any> = {
      folder: { muiIconName: 'Folder', emoji: '📁' },
      shape: { muiIconName: 'Category', emoji: '🔷' },
      location: { muiIconName: 'LocationOn', emoji: '📍' },
      route: { muiIconName: 'Route', emoji: '🛣️' },
      spreadsheet: { muiIconName: 'TableChart', emoji: '📊' },
      basemap: { muiIconName: 'Map', emoji: '🗺️' },
      styler: { muiIconName: 'Palette', emoji: '🎨' },
      project: { muiIconName: 'AccountTree', emoji: '🏗️' },
    };
    
    this.definition = {
      ...this.definition,
      icon: iconMap[nodeType] || { muiIconName: 'Extension', emoji: '🔌' },
    };
    return this;
  }
  
  setCategory(treeId: string = '*'): this {
    this.definition = {
      ...this.definition,
      category: {
        treeId: treeId as any,
        menuGroup: 'basic',
        createOrder: 0,
      },
    };
    return this;
  }
  
  fromJson(json: any): this {
    this.definition = { ...json };
    return this;
  }
  
  async build(): Promise<PluginDefinition> {
    if (!this.definition.nodeType) {
      throw new Error('NodeType is required');
    }
    
    // デフォルト値の設定
    if (!this.definition.category) {
      this.setCategory();
    }
    
    return this.definition as PluginDefinition;
  }
}

/**
 * プラグイン定義バリデーター
 */
export class PluginDefinitionValidator {
  validate(definition: PluginDefinition): void {
    const errors: string[] = [];
    
    if (!definition.nodeType) {
      errors.push('nodeType is required');
    }
    
    if (!definition.name) {
      errors.push('name is required');
    }
    
    if (!definition.displayName) {
      errors.push('displayName is required');
    }
    
    if (!definition.database) {
      errors.push('database configuration is required');
    }
    
    if (!definition.category) {
      errors.push('category is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Plugin definition validation failed: ${errors.join(', ')}`);
    }
  }
}