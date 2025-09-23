import type { ComponentType } from 'react';
import type { FolderEntity } from '../entities/FolderEntity.js';
import type { FolderDialogExtension, FolderEntityExtension, FolderExtension } from '../api/FolderExtensionAPI.js';
import { createFolderExtension, folderExtensionRegistry } from '../api/FolderExtensionAPI.js';
import type {
  DialogStepDefinition,
  NodeId,
  NodeType,
  StepValidation,
  ValidationExtension,
  ValidationResult,
} from '@hierarchidb/common-type';
import { registerTaggable, unregisterTaggable } from '@hierarchidb/tag';
import { wrapDialogStepComponent } from './wrapDialogStepComponent.js';

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
    const evaluateSteps = this.getStepStateEvaluator?.bind(this)();
    const canSubmit = this.getSubmitEligibility?.bind(this)();

    if (!createSteps && !editSteps && !transformData && !validation && !evaluateSteps && !canSubmit) {
      return undefined;
    }

    return {
      createSteps,
      editSteps,
      transformData,
      validation,
      evaluateSteps,
      canSubmit,
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
      this.saveExtendedData?.bind(this) ?? (async (_nodeId: NodeId, _data: Record<string, any>) => {
      });

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
   * Override to provide explicit step state evaluator (navigable/filled arrays based on entity/form data).
   * The returned arrays should align with the final step sequence (by index) or accept stepNumbers via
   * the second argument to map by stepNumber.
   */
  protected getStepStateEvaluator?(): {
    getNavigableSteps: (data: any, stepNumbers?: number[]) => boolean[];
    getFilledSteps: (data: any, stepNumbers?: number[]) => boolean[];
  };

  /**
   * Override to provide overall submit eligibility check (AND-composed across extensions).
   */
  protected getSubmitEligibility?(): (data: any) => boolean | Promise<boolean>;

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
    _changes: Partial<FolderEntity>,
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
  protected createDialogStep<T extends object>(config: {
    id: string;
    label: string;
    description?: string;
    component: ComponentType<any>;
    validation?: {
      validate: (data: T) => Promise<{ isValid: boolean; errors?: string[] }>;
      canProceed?: (data: T) => boolean;
    };
    required?: boolean;
    order?: number;
    //dependsOn?: string[];
  }): DialogStepDefinition {
    const StepWrapper = wrapDialogStepComponent(config.component);

    return {
      stepNumber: config.order ?? 0,
      title: config.label,
      component: StepWrapper,
      validation: (config.validation
        ? ({
          validate: async (data: unknown): Promise<ValidationResult> => {
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
