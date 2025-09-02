import type { FolderEntity } from '../entities/FolderEntity';
import type {
  FolderExtension,
  FolderDialogExtension,
  FolderEntityExtension,
} from '../api/FolderExtensionAPI';
import { createFolderExtension, folderExtensionRegistry } from '../api/FolderExtensionAPI';
import type {
  DialogStepDefinition,
  ValidationExtension,
  StepValidation,
  ValidationResult,
  NodeId,
  NodeType,
} from '@hierarchidb/common-type';
import type React from 'react';
import { registerTaggable, unregisterTaggable } from '@hierarchidb/tag';

// Temporary type definitions for missing types
// Use DialogStepDefinition from common types

// Use ValidationExtension from common types

/*
interface PluginExtensionConfig {
  id: string;
  name: string;
  version: string;
}

interface ExtendableNodeTypeDefinition {
  nodeType: string;
  extensions: any[];
}
 */

/**
 * Base class for plugins that extend the folder-plugin plugin
 */
export abstract class BaseFolderPlugin {
  /**
   * Unique identifier for this plugin
   */
  abstract readonly pluginId: string;

  /**
   * Display name for this plugin
   */
  abstract readonly pluginName: string;

  /**
   * Description of what this plugin adds to folders
   */
  abstract readonly pluginDescription: string;

  /**
   * Version of this plugin
   */
  abstract readonly pluginVersion: string;

  /**
   * Other folder-plugin extensions this plugin depends on
   */
  readonly dependencies: string[] = [];

  /**
   * Initialize the plugin and register with folder-plugin extension system
   */
  async initialize(): Promise<void> {
    const extension = this.createExtension();
    folderExtensionRegistry.register(extension);

    // Allow subclasses to perform additional initialization
    await this.onInitialize();

    // Register folder as taggable by default
    registerTaggable('folder' as NodeType);
  }

  /**
   * Cleanup when plugin is unloaded
   */
  async cleanup(): Promise<void> {
    // Allow subclasses to perform cleanup first
    await this.onCleanup();

    folderExtensionRegistry.unregister(this.pluginId);

    // Unregister capability
    unregisterTaggable('folder' as NodeType);
  }

  /**
   * Create the folder-plugin extension configuration
   */
  protected createExtension(): FolderExtension {
    return createFolderExtension({
      id: this.pluginId,
      name: this.pluginName,
      description: this.pluginDescription,
      version: this.pluginVersion,
      dependencies: this.dependencies,
      dialog: this.createDialogExtension(),
      entity: this.createEntityExtension(),
      lifecycle: {
        afterCreate: this.afterCreate?.bind(this),
        beforeUpdate: this.beforeUpdate?.bind(this),
        afterUpdate: this.afterUpdate?.bind(this),
        beforeDelete: this.beforeDelete?.bind(this),
      },
    });
  }

  /**
   * Create base-dialog extension configuration
   */
  protected createDialogExtension(): FolderDialogExtension | undefined {
    const createSteps = this.getCreateDialogSteps();
    const editSteps = this.getEditDialogSteps();
    const transformData = this.transformDialogData?.bind(this);
    const validation = this.getValidationExtension();

    if (!createSteps && !editSteps && !transformData && !validation) {
      return undefined;
    }

    return {
      createSteps,
      editSteps,
      transformData,
      validation,
    };
  }

  /**
   * Create entity extension configuration
   */
  protected createEntityExtension(): FolderEntityExtension | undefined {
    const additionalFields = this.getAdditionalEntityFields();
    const beforeSave = this.beforeSaveEntity?.bind(this);
    const afterLoad = this.afterLoadEntity?.bind(this);
    const validateEntity = this.validateEntity?.bind(this);
    const getExtendedData = this.getExtendedData?.bind(this) ?? (async (_nodeId: NodeId) => ({}));
    const saveExtendedData =
      this.saveExtendedData?.bind(this) ?? (async (_nodeId: NodeId, _data: Record<string, any>) => {});

    if (!additionalFields?.length && !beforeSave && !afterLoad && !validateEntity) {
      return undefined;
    }

    return {
      additionalFields,
      beforeSave,
      afterLoad,
      validateEntity,
      getExtendedData,
      saveExtendedData,
    };
  }

  /**
   * Override to provide additional base-dialog steps for create mode
   */
  protected getCreateDialogSteps(): DialogStepDefinition[] | undefined {
    return undefined;
  }

  /**
   * Override to provide additional base-dialog steps for edit mode
   */
  protected getEditDialogSteps(): DialogStepDefinition[] | undefined {
    return undefined;
  }

  /**
   * Override to transform base-dialog data before submission
   */
  protected transformDialogData?(data: Record<string, any>): Record<string, any> {
    return data;
  }

  /**
   * Override to provide validation extension
   */
  protected getValidationExtension(): ValidationExtension | undefined {
    return undefined;
  }

  /**
   * Override to specify additional entity fields
   */
  protected getAdditionalEntityFields(): string[] | undefined {
    return undefined;
  }

  /**
   * Override to transform entity before saving
   */
  protected async beforeSaveEntity?(entity: Partial<FolderEntity>): Promise<Partial<FolderEntity>> {
    return entity;
  }

  /**
   * Override to transform entity after loading
   */
  protected async afterLoadEntity?(entity: FolderEntity): Promise<FolderEntity> {
    return entity;
  }

  /**
   * Override to validate entity
   */
  protected async validateEntity?(_entity: Partial<FolderEntity>): Promise<string[]> {
    return [];
  }

  /**
   * Override to get extended data from entity
   */
  protected async getExtendedData?(_nodeId: NodeId): Promise<Record<string, any>> {
    return {};
  }

  /**
   * Override to save extended data to entity
   */
  protected async saveExtendedData?(_nodeId: NodeId, _data: Record<string, any>): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: called after folder-plugin creation
   */
  protected async afterCreate?(_node: any, _entity: FolderEntity): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: called before folder-plugin update
   */
  protected async beforeUpdate?(
    _node: any,
    _entity: FolderEntity,
    _changes: Partial<FolderEntity>
  ): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: called after folder-plugin update
   */
  protected async afterUpdate?(_node: any, _entity: FolderEntity): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: called before folder-plugin deletion
   */
  protected async beforeDelete?(_node: any, _entity: FolderEntity): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Override to perform additional initialization
   */
  protected async onInitialize(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Override to perform additional cleanup
   */
  protected async onCleanup(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Helper method to create a base-dialog step definition
   */
  protected createDialogStep<T>(config: {
    id: string;
    label: string;
    description?: string;
    component: React.ComponentType<any>;
    validation?: {
      validate: (data: T) => Promise<{ isValid: boolean; errors?: string[] }>;
      canProceed?: (data: T) => boolean;
    };
    required?: boolean;
    order?: number;
    //dependsOn?: string[];
  }): DialogStepDefinition {
    return {
      stepNumber: config.order ?? 0,
      title: config.label,
      component: config.component as any,
      validation: (config.validation
        ? ({
            validate: async (data: any): Promise<ValidationResult> => {
              const result = await config.validation!.validate(data as T);
              return result.isValid
                ? { valid: true }
                : { valid: false, message: (result.errors || []).join(', ') };
            },
          } as StepValidation<unknown>)
        : undefined),
      //dependsOn: config.dependsOn?.map((dep) => (typeof dep === 'string' ? parseInt(dep) : dep)),
    };
  }

  /**
   * Helper method to create a field extension
   */
  protected createFieldExtension(config: {
    fieldName: string;
    fieldType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    label: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
    validation?: (value: any) => string | undefined;
  }): any {
    return {
      fieldName: `${this.pluginId}_${config.fieldName}`,
      fieldType: config.fieldType,
      label: config.label,
      description: config.description,
      required: config.required,
      defaultValue: config.defaultValue,
      validation: config.validation,
      pluginId: this.pluginId,
    };
  }
}
