import type { 
  PluginDefinition, 
  NodeTypeIconDefinition,
  CategoryDefinition,
  PluginDatabaseConfig,
  PluginUIConfig,
  PluginAPIConfig,
  PluginValidationConfig,
  DatabaseSchema
} from '../packages/common/types/src/plugin-definition';
import type { NodeType } from '../packages/common/types/src/id-types';

export interface PackageJsonContent {
  name: string;
  version: string;
  hierarchidb?: {
    plugin?: {
      nodeType: string;
      name?: string;
      displayName?: string;
      description?: string;
      icon?: {
        mui?: string;
        emoji?: string;
        color?: string;
        svg?: string;
        description?: string;
      };
      category?: {
        treeId?: string;
        menuGroup?: 'basic' | 'container' | 'document' | 'advanced';
        createOrder?: number;
      };
      priority?: number;
      database?: {
        dbName?: string;
        tableName?: string;
        schema?: {
          fields?: Array<{
            name: string;
            type: string;
            indexed?: boolean;
          }>;
        };
        version?: number;
      };
      ui?: {
        dialogComponentPath?: string;
        panelComponentPath?: string;
        formComponentPath?: string;
        iconComponentPath?: string;
      };
      api?: {
        workerExtensions?: Record<string, unknown>;
        clientExtensions?: Record<string, unknown>;
      };
      validation?: {
        namePattern?: string;
        maxChildren?: number;
        allowedChildTypes?: string[];
      };
      extends?: string;
      dependencies?: string[];
    };
  };
}

export class PluginDefinitionBuilder {
  buildDefinition(packageName: string, packageJson: PackageJsonContent): PluginDefinition | null {
    try {
      const pluginConfig = packageJson.hierarchidb?.plugin;
      
      if (!pluginConfig) {
        console.error(`Package ${packageName} does not have hierarchidb.plugin configuration`);
        return null;
      }
      
      if (!pluginConfig.nodeType) {
        throw new Error(`Package ${packageName} has hierarchidb.plugin but missing required nodeType field`);
      }
      
      const nodeType = this.validateNodeType(pluginConfig.nodeType);
      
      const definition: PluginDefinition = {
        nodeType,
        name: pluginConfig.name || packageName,
        displayName: pluginConfig.displayName || pluginConfig.name || packageName,
        description: pluginConfig.description,
        version: packageJson.version,
        
        icon: this.buildIconDefinition(pluginConfig.icon),
        category: this.buildCategoryDefinition(pluginConfig.category, pluginConfig.priority),
        database: this.buildDatabaseConfig(pluginConfig, nodeType),
        
        ui: this.buildUIConfig(pluginConfig.ui),
        api: this.buildAPIConfig(pluginConfig.api),
        validation: this.buildValidationConfig(pluginConfig.validation),
        
        extends: pluginConfig.extends,
        dependencies: this.buildDependencies(pluginConfig, nodeType),
        priority: pluginConfig.priority || 1000
      };
      
      return definition;
      
    } catch (error) {
      console.error(`Failed to build PluginDefinition for ${packageName}:`, error);
      return null;
    }
  }
  
  buildDefinitions(packages: Map<string, PackageJsonContent>): Map<NodeType, PluginDefinition> {
    const definitions = new Map<NodeType, PluginDefinition>();
    
    packages.forEach((packageJson, packageName) => {
      const definition = this.buildDefinition(packageName, packageJson);
      
      if (definition) {
        definitions.set(definition.nodeType, definition);
        console.log(`Generated plugin definition for ${packageName} (${definition.nodeType})`);
      }
    });
    
    console.log(`Generated ${definitions.size} plugin definitions`);
    return definitions;
  }
  
  private validateNodeType(nodeType: string): NodeType {
    if (!nodeType || typeof nodeType !== 'string') {
      throw new Error('Invalid nodeType: must be a non-empty string');
    }
    
    return nodeType as NodeType;
  }
  
  private buildIconDefinition(iconConfig: any): NodeTypeIconDefinition {
    if (!iconConfig) {
      return {
        muiIconName: 'Extension',
        emoji: '📦',
        color: '#666666'
      };
    }
    
    return {
      muiIconName: iconConfig.mui || 'Extension',
      emoji: iconConfig.emoji || '📦',
      color: iconConfig.color || '#666666',
      svg: iconConfig.svg,
      description: iconConfig.description
    };
  }
  
  private buildCategoryDefinition(
    categoryConfig: any, 
    priority?: number
  ): CategoryDefinition {
    const category: CategoryDefinition = {
      treeId: (categoryConfig?.treeId || '*') as any,
      menuGroup: categoryConfig?.menuGroup || 'basic',
      createOrder: categoryConfig?.createOrder || priority || 1000
    };
    
    return category;
  }
  
  private buildDatabaseConfig(pluginConfig: any, nodeType: NodeType): PluginDatabaseConfig {
    const dbConfig = pluginConfig.database || {};
    const tableName = dbConfig.tableName || `${nodeType}s`.replace('-plugin', '');
    
    const schema: DatabaseSchema = {};
    schema[tableName] = this.buildDatabaseSchema(dbConfig.schema);
    
    return {
      dbName: dbConfig.dbName || 'CoreDB',
      schema,
      version: dbConfig.version || 1
    };
  }
  
  private buildDatabaseSchema(schemaConfig: any): string {
    const indexedFields: string[] = ['&id', 'nodeId'];
    
    if (schemaConfig?.fields) {
      for (const field of schemaConfig.fields) {
        if (field.name === 'name') {
          if (!indexedFields.includes('name')) {
            indexedFields.push('name');
          }
        } else if (field.indexed) {
          if (!indexedFields.includes(field.name)) {
            indexedFields.push(field.name);
          }
        }
      }
    }
    
    const standardFields = ['createdAt', 'updatedAt', 'version'];
    for (const field of standardFields) {
      if (!indexedFields.includes(field)) {
        indexedFields.push(field);
      }
    }
    
    return indexedFields.join(', ');
  }
  
  private buildDependencies(pluginConfig: any, nodeType: NodeType): string[] {
    const dependencies = pluginConfig.dependencies || [];
    
    //  folderfolder
    if (nodeType !== ('folder' as NodeType) && 
        nodeType !== ('folder-plugin' as NodeType) &&
        !dependencies.includes('folder') &&
        !dependencies.includes('folder-plugin')) {
      dependencies.push('folder');
    }
    
    return dependencies;
  }
  
  private buildUIConfig(uiConfig: any): PluginUIConfig | undefined {
    if (!uiConfig) {
      return undefined;
    }
    
    return {
      dialogComponentPath: uiConfig.dialogComponentPath,
      panelComponentPath: uiConfig.panelComponentPath,
      formComponentPath: uiConfig.formComponentPath,
      iconComponentPath: uiConfig.iconComponentPath
    };
  }
  
  private buildAPIConfig(apiConfig: any): PluginAPIConfig | undefined {
    if (!apiConfig) {
      return undefined;
    }
    
    return {
      workerExtensions: apiConfig.workerExtensions,
      clientExtensions: apiConfig.clientExtensions
    };
  }
  
  private buildValidationConfig(validationConfig: any): PluginValidationConfig | undefined {
    if (!validationConfig) {
      return undefined;
    }
    
    return {
      namePattern: validationConfig.namePattern ? new RegExp(validationConfig.namePattern) : undefined,
      maxChildren: validationConfig.maxChildren,
      allowedChildTypes: validationConfig.allowedChildTypes?.map((type: string) => type as NodeType),
      customValidators: validationConfig.customValidators
    };
  }
}