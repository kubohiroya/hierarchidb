import type {
  PluginDefinition,
  NodeTypeIconDefinition,
  CategoryDefinition,
  PluginDatabaseConfig,
  PluginUIConfig,
  PluginAPIConfig,
  PluginValidationConfig,
  PluginManifestAPIConfig,
  PluginManifestDatabaseConfig,
  PluginManifestDatabaseSchema,
  PluginManifestUIConfig,
  PluginManifestValidationConfig,
  DatabaseSchema,
  NodeType,
  PluginMetadata,
} from '@hierarchidb/common-types';

export type PluginManifestContent = PluginMetadata;

export class PluginDefinitionBuilder {
  buildDefinition(packageName: string, manifest: PluginManifestContent | undefined): PluginDefinition | null {
    try {
      if (!manifest) {
        console.error(`Package ${packageName} does not expose plugin-manifest metadata`);
        return null;
      }
      const nodeType = this.validateNodeType(manifest.nodeType as string);

      const definition: PluginDefinition = {
        nodeType,
        name: manifest.name || packageName,
        displayName: manifest.displayName || manifest.name || packageName,
        description: manifest.description,
        version: manifest.version,

        icon: this.buildIconDefinition(manifest.icon),
        category: this.buildCategoryDefinition(manifest.category, manifest.priority),
        database: this.buildDatabaseConfig(manifest, nodeType),

        ui: this.buildUIConfig(manifest.ui),
        api: this.buildAPIConfig(manifest.api),
        validation: this.buildValidationConfig(manifest.validation),

        extends: manifest.extends,
        dependencies: this.buildDependencies(manifest, nodeType),
        priority: manifest.priority ?? 1000
      };

      return definition;
    } catch (error) {
      console.error(`Failed to build PluginDefinition for ${packageName}:`, error);
      return null;
    }
  }

  buildDefinitions(packages: Map<string, PluginManifestContent | undefined>): Map<NodeType, PluginDefinition> {
    const definitions = new Map<NodeType, PluginDefinition>();

    packages.forEach((manifest, packageName) => {
      const definition = this.buildDefinition(packageName, manifest);

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
    const iconName = iconConfig.mui || iconConfig.muiIconName || 'Extension';
    return {
      muiIconName: iconName,
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
  
  private buildDatabaseConfig(pluginConfig: PluginManifestContent, nodeType: NodeType): PluginDatabaseConfig {
    const dbConfig: PluginManifestDatabaseConfig = pluginConfig.database ?? {};
    const tableName = dbConfig.tableName ?? `${nodeType}s`.replace('-plugin', '');

    const schema: DatabaseSchema = {};
    schema[tableName] = this.buildDatabaseSchema(dbConfig.schema);

    return {
      dbName: dbConfig.dbName ?? 'CoreDB',
      schema,
      version: dbConfig.version ?? 1,
    };
  }

  private buildDatabaseSchema(schemaConfig?: PluginManifestDatabaseSchema): string {
    const indexedFields: string[] = ['&id', 'nodeId'];

    const fields = schemaConfig?.fields ?? [];
    for (const field of fields) {
      if (!field?.name) continue;
      if (field.name === 'name') {
        if (!indexedFields.includes('name')) indexedFields.push('name');
      } else if (field.indexed) {
        if (!indexedFields.includes(field.name)) indexedFields.push(field.name);
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
  
  private buildDependencies(pluginConfig: PluginManifestContent, nodeType: NodeType): string[] {
    const dependencies = Array.isArray(pluginConfig.dependencies)
      ? [...pluginConfig.dependencies]
      : [];

    //  folderfolder
    if (nodeType !== ('folder' as NodeType) && 
        nodeType !== ('folder-plugin' as NodeType) &&
        !dependencies.includes('folder') &&
        !dependencies.includes('folder-plugin')) {
      dependencies.push('folder');
    }

    return dependencies;
  }
  
  private buildUIConfig(uiConfig: PluginManifestUIConfig | undefined): PluginUIConfig | undefined {
    if (!uiConfig) return undefined;
    const {
      dialogComponentPath,
      panelComponentPath,
      formComponentPath,
      iconComponentPath,
    } = uiConfig;
    if (
      !dialogComponentPath &&
      !panelComponentPath &&
      !formComponentPath &&
      !iconComponentPath
    ) {
      return undefined;
    }

    return {
      dialogComponentPath,
      panelComponentPath,
      formComponentPath,
      iconComponentPath,
    };
  }
  
  private buildAPIConfig(apiConfig: PluginManifestAPIConfig | undefined): PluginAPIConfig | undefined {
    if (!apiConfig) return undefined;
    const hasWorker = apiConfig.workerExtensions && Object.keys(apiConfig.workerExtensions).length > 0;
    const hasClient = apiConfig.clientExtensions && Object.keys(apiConfig.clientExtensions).length > 0;

    if (!hasWorker && !hasClient) {
      return undefined;
    }

    return {
      workerExtensions: apiConfig.workerExtensions,
      clientExtensions: apiConfig.clientExtensions,
    };
  }
  
  private buildValidationConfig(validationConfig: PluginManifestValidationConfig | undefined): PluginValidationConfig | undefined {
    if (!validationConfig) return undefined;

    const {
      namePattern,
      maxChildren,
      allowedChildTypes,
      customValidators,
    } = validationConfig;

    if (
      namePattern == null &&
      maxChildren == null &&
      (!allowedChildTypes || allowedChildTypes.length === 0) &&
      (!customValidators || customValidators.length === 0)
    ) {
      return undefined;
    }

    const compiledPattern = typeof namePattern === 'string'
      ? new RegExp(namePattern)
      : namePattern;

    return {
      namePattern: compiledPattern,
      maxChildren,
      allowedChildTypes: allowedChildTypes?.map((type) => type as NodeType),
      customValidators: customValidators as PluginValidationConfig['customValidators'],
    };
  }
}
