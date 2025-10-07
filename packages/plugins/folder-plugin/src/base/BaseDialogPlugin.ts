import type { FolderEntity } from '../entities/FolderEntity.js';
import type {
  FolderEntityExtension,
  FolderExtension,
} from '../api/FolderDialogExtensionAPI.js';
import { createFolderExtension, folderExtensionRegistry } from '../api/FolderDialogExtensionAPI.js';
import type {
  NodeId,
  NodeType,
  PeerEntity,
  TreeNode,
} from '@hierarchidb/common-types';
import { registerTaggable, unregisterTaggable } from '@hierarchidb/tag';
import { BaseDialogPlugin as CoreBaseDialogPlugin } from '@hierarchidb/plugin-sdk';

/**
 * Base class for dialog-based extensions wired into the folder-plugin dialog system
 */
export abstract class BaseDialogPlugin<TDialog extends PeerEntity = PeerEntity> extends CoreBaseDialogPlugin<TDialog> {
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
   * Other dialog extensions this plugin depends on
   */
  protected readonly dependencies: string[] = [];

  async initialize(): Promise<void> {
    const extension = this.createExtension();
    folderExtensionRegistry.register(extension);
    await super.onInitialize();
    registerTaggable('folder' as NodeType);
  }

  async cleanup(): Promise<void> {
    await super.onCleanup();
    folderExtensionRegistry.unregister(this.pluginId);
    unregisterTaggable('folder' as NodeType);
  }

  /**
   * Create the dialog extension configuration
   */
  protected createExtension(): FolderExtension<TDialog> {
    const base = super.createExtension();
    return createFolderExtension<TDialog>({
      id: base.id,
      name: base.name,
      description: base.description,
      version: base.metadata.version,
      dependencies: base.metadata.dependencies,
      dialog: base.dialog,
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
   * Create entity extension configuration
   */
  protected createEntityExtension(): FolderEntityExtension | undefined {
    const additionalFields = this.getAdditionalEntityFields();
    const beforeSave = this.beforeSaveEntity?.bind(this);
    const afterLoad = this.afterLoadEntity?.bind(this);
    const validateEntity = this.validateEntity?.bind(this);
    const getExtendedData = this.getExtendedData?.bind(this) ?? (async (_nodeId: NodeId) => ({}));
    const saveExtendedData =
      this.saveExtendedData?.bind(this) ?? (async (_nodeId: NodeId, _data: Record<string, unknown>) => {
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
  protected async getExtendedData?(_nodeId: NodeId): Promise<Record<string, unknown>> {
    return {};
  }

  /**
   * Override to save extended data to entity
   */
  protected async saveExtendedData?(
    _nodeId: NodeId,
    _data: Record<string, unknown>,
  ): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: called after folder-plugin creation
   */
  protected async afterCreate?(_node: TreeNode, _entity: FolderEntity): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: called before folder-plugin update
   */
  protected async beforeUpdate?(
    _node: TreeNode,
    _entity: FolderEntity,
    _changes: Partial<FolderEntity>,
  ): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: called after folder-plugin update
   */
  protected async afterUpdate?(_node: TreeNode, _entity: FolderEntity): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Lifecycle hook: called before folder-plugin deletion
   */
  protected async beforeDelete?(_node: TreeNode, _entity: FolderEntity): Promise<void> {
    // Default implementation does nothing
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
    defaultValue?: unknown;
    validation?: (value: unknown) => string | undefined;
  }): Record<string, unknown> {
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
