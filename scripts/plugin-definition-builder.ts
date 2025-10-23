import type { NodeType } from '@hierarchidb/common-types';
import type {
  CategoryDefinition,
  DatabaseSchema,
  PluginAPIConfig,
  PluginDatabaseConfig,
  PluginDefinition,
  PluginManifestAPIConfig,
  PluginManifestDatabaseConfig,
  PluginManifestDatabaseSchema,
  PluginManifestUIConfig,
  PluginManifestValidationConfig,
  PluginMetadata,
  PluginUIConfig,
  PluginValidationConfig,
  NodeTypeIconDefinition,
} from '@hierarchidb/plugin-ui-sdk';

export type PluginManifestContent = PluginMetadata;

export class PluginDefinitionBuilder {
  buildDefinition(packageName: string, manifest: PluginManifestContent | undefined | null): PluginDefinition | null {
    try {
      if (!manifest) {
        console.error(`[plugin-definition-builder] "${packageName}" does not expose plugin metadata.`);
        return null;
      }

      const nodeType = this.validateNodeType(manifest.nodeType ?? manifest.id);

      const definition: PluginDefinition = {
        nodeType,
        name: manifest.name ?? packageName,
        displayName: manifest.displayName ?? manifest.name ?? packageName,
        description: manifest.description,
        version: manifest.version ?? '0.0.0',
        icon: this.buildIconDefinition(manifest.icon),
        category: this.buildCategoryDefinition(manifest.category, manifest.priority),
        database: this.buildDatabaseConfig(manifest.database, nodeType),
        ui: this.buildUIConfig(manifest.ui),
        api: this.buildAPIConfig(manifest.api),
        validation: this.buildValidationConfig(manifest.validation),
        extends: manifest.extends,
        dependencies: this.buildDependencies(manifest.dependencies, nodeType),
        priority: manifest.priority ?? 1000,
        visibility: undefined,
      };

      return definition;
    } catch (error) {
      console.error(`[plugin-definition-builder] Failed to build definition for "${packageName}":`, error);
      return null;
    }
  }

  buildDefinitions(packages: Map<string, PluginManifestContent | undefined | null>): Map<NodeType, PluginDefinition> {
    const definitions = new Map<NodeType, PluginDefinition>();

    packages.forEach((manifest, packageName) => {
      const definition = this.buildDefinition(packageName, manifest);
      if (definition) {
        definitions.set(definition.nodeType, definition);
      }
    });

    return definitions;
  }

  private validateNodeType(nodeType: string | undefined): NodeType {
    if (!nodeType || typeof nodeType !== 'string' || nodeType.trim().length === 0) {
      throw new Error('Invalid nodeType: expected non-empty string in plugin metadata');
    }
    return nodeType.trim() as NodeType;
  }

  private buildIconDefinition(iconConfig: PluginManifestContent['icon']): NodeTypeIconDefinition {
    if (!iconConfig || typeof iconConfig !== 'object') {
      return {
        muiIconName: 'Extension',
        emoji: '📦',
        color: '#666666',
      };
    }

    const icon: NodeTypeIconDefinition = {
      muiIconName: iconConfig.muiIconName ?? iconConfig.mui ?? 'Extension',
      emoji: iconConfig.emoji ?? '📦',
      color: iconConfig.color ?? '#666666',
      svg: iconConfig.svg,
      description: iconConfig.description,
    };

    return icon;
  }

  private buildCategoryDefinition(categoryConfig: PluginManifestContent['category'], priority?: number): CategoryDefinition {
    if (categoryConfig && typeof categoryConfig === 'object') {
      const menuGroup = this.normalizeMenuGroup((categoryConfig as Record<string, unknown>).menuGroup) ?? 'basic';

      const treeIdCandidate = (categoryConfig as Record<string, unknown>).treeId;
      const treeId = typeof treeIdCandidate === 'string' && treeIdCandidate.trim().length > 0
        ? (treeIdCandidate.trim() as any)
        : '*';

      const createOrderCandidate = (categoryConfig as Record<string, unknown>).createOrder;
      const createOrder = typeof createOrderCandidate === 'number' && Number.isFinite(createOrderCandidate)
        ? createOrderCandidate
        : priority ?? 1000;

      return {
        treeId,
        menuGroup,
        createOrder,
      };
    }

    if (typeof categoryConfig === 'string' && categoryConfig.trim().length > 0) {
      return {
        treeId: '*',
        menuGroup: this.normalizeMenuGroup(categoryConfig) ?? 'basic',
        createOrder: priority ?? 1000,
      };
    }

    return {
      treeId: '*',
      menuGroup: 'basic',
      createOrder: priority ?? 1000,
    };
  }

  private buildDatabaseConfig(databaseConfig: PluginManifestDatabaseConfig | undefined, nodeType: NodeType): PluginDatabaseConfig {
    const config = databaseConfig ?? {};
    const tableName = config.tableName ?? `${nodeType}s`.replace(/-plugin$/g, '');

    const schema: DatabaseSchema = {
      [tableName]: this.buildDatabaseSchema(config.schema),
    };

    return {
      dbName: config.dbName ?? 'CoreDB',
      schema,
      version: config.version ?? 1,
    };
  }

  private buildDatabaseSchema(schemaConfig: PluginManifestDatabaseSchema | undefined): string {
    const indexedFields = new Set<string>(['&id', 'nodeId']);

    if (schemaConfig?.fields) {
      for (const field of schemaConfig.fields) {
        if (!field?.name) continue;
        if (field.name === 'name') {
          indexedFields.add('name');
        } else if (field.indexed) {
          indexedFields.add(field.name);
        }
      }
    }

    for (const field of ['createdAt', 'updatedAt', 'version']) {
      indexedFields.add(field);
    }

    return Array.from(indexedFields).join(', ');
  }

  private buildDependencies(dependencies: PluginManifestContent['dependencies'], nodeType: NodeType): string[] {
    const list = Array.isArray(dependencies) ? [...dependencies] : [];

    const normalized = list
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);

    if (
      nodeType !== ('folder' as NodeType) &&
      nodeType !== ('folder-plugin' as NodeType) &&
      !normalized.includes('folder') &&
      !normalized.includes('folder-plugin')
    ) {
      normalized.push('folder');
    }

    return Array.from(new Set(normalized));
  }

  private buildUIConfig(uiConfig: PluginManifestUIConfig | undefined): PluginUIConfig | undefined {
    if (!uiConfig) return undefined;

    const config: PluginUIConfig = {
      dialogComponentPath: uiConfig.dialogComponentPath,
      panelComponentPath: uiConfig.panelComponentPath,
      formComponentPath: uiConfig.formComponentPath,
      iconComponentPath: uiConfig.iconComponentPath,
    };

    if (
      !config.dialogComponentPath &&
      !config.panelComponentPath &&
      !config.formComponentPath &&
      !config.iconComponentPath
    ) {
      return undefined;
    }

    return config;
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

    const namePattern = typeof validationConfig.namePattern === 'string'
      ? new RegExp(validationConfig.namePattern)
      : validationConfig.namePattern;

    const allowedChildTypes = validationConfig.allowedChildTypes?.map((type) => type as NodeType);

    if (
      !namePattern &&
      validationConfig.maxChildren == null &&
      (!allowedChildTypes || allowedChildTypes.length === 0) &&
      (!validationConfig.customValidators || validationConfig.customValidators.length === 0)
    ) {
      return undefined;
    }

    return {
      namePattern,
      maxChildren: validationConfig.maxChildren,
      allowedChildTypes,
      customValidators: validationConfig.customValidators as PluginValidationConfig['customValidators'],
    };
  }

  private normalizeMenuGroup(value: unknown): CategoryDefinition['menuGroup'] | undefined {
    if (typeof value !== 'string') return undefined;
    if (value === 'basic' || value === 'container' || value === 'document' || value === 'advanced') {
      return value;
    }
    return undefined;
  }
}

export default PluginDefinitionBuilder;
