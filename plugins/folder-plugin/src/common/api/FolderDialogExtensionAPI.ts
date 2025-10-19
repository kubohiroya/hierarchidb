import type {
  NodeDialogExtension,
  NodeDialogHooks,
  NodeDialogExtensionMetadata,
  StepArrayEvaluator,
  NodeDialogExtensionRegistry,
  DialogStepDefinition,
  BaseEntityExtension,
  ValidationExtension,
  ExtendingNodeTypeDefinition,
} from '@hierarchidb/plugin-ui-sdk';
import {
} from '@hierarchidb/common-api';
import type {
  PeerEntity,
  TreeNode,
  NodeId,
} from '@hierarchidb/common-types';
import type { FolderEntity } from '../types/FolderEntity.js';

export type FolderDialogHooks<TDialog extends PeerEntity = PeerEntity> = NodeDialogHooks<TDialog>;
export type NodeDialogStepEvaluator<TDialog extends PeerEntity = PeerEntity> = StepArrayEvaluator<TDialog>;

export interface FolderDialogExtension<TDialog extends PeerEntity = PeerEntity> extends FolderDialogHooks<TDialog> {}

export interface FolderEntityExtension extends Partial<BaseEntityExtension<FolderEntity>> {
  additionalFields?: string[];
  beforeSave?: (entity: Partial<FolderEntity>) => Promise<Partial<FolderEntity>>;
  afterLoad?: (entity: FolderEntity) => Promise<FolderEntity>;
  validateEntity?: (entity: Partial<FolderEntity>) => Promise<string[]>;
  getExtendedData?: (nodeId: NodeId) => Promise<Partial<FolderEntity>>;
  saveExtendedData?: (nodeId: NodeId, data: Partial<FolderEntity>) => Promise<void>;
}

export interface FolderExtension<TDialog extends PeerEntity = PeerEntity>
  extends NodeDialogExtension<TDialog> {
  metadata: NodeDialogExtensionMetadata;
  dialog?: NodeDialogHooks<TDialog>;
  entity?: FolderEntityExtension;
  lifecycle?: {
    afterCreate?: (node: TreeNode, entity: FolderEntity) => Promise<void>;
    beforeUpdate?: (
      node: TreeNode,
      entity: FolderEntity,
      changes: Partial<FolderEntity>,
    ) => Promise<void>;
    afterUpdate?: (node: TreeNode, entity: FolderEntity) => Promise<void>;
    beforeDelete?: (node: TreeNode, entity: FolderEntity) => Promise<void>;
  };
}

type RegistryPeerEntity = PeerEntity<Record<string, unknown>>;

export class FolderExtensionRegistry {
  constructor(private readonly baseRegistry: NodeDialogExtensionRegistry) {}

  register<TDialog extends PeerEntity>(extension: FolderExtension<TDialog>): void {
    this.baseRegistry.register(extension);
  }

  unregister(extensionId: string): void {
    this.baseRegistry.unregister(extensionId);
  }

  getCreateDialogSteps(): DialogStepDefinition[] {
    return this.baseRegistry.getCreateDialogSteps();
  }

  getEditDialogSteps(): DialogStepDefinition[] {
    return this.baseRegistry.getEditDialogSteps();
  }

  getDialogEvaluators(): StepArrayEvaluator<RegistryPeerEntity>[] {
    return this.baseRegistry.getDialogEvaluators();
  }

  getSubmitEvaluators(): Array<(data: RegistryPeerEntity) => boolean | Promise<boolean>> {
    return this.baseRegistry.getSubmitEvaluators();
  }

  async transformData<TDialog extends PeerEntity>(data: TDialog): Promise<TDialog> {
    return this.baseRegistry.transformData(data);
  }

  private getExtensionsInOrder(): FolderExtension<RegistryPeerEntity>[] {
    return this.baseRegistry.getExtensionsInOrder() as FolderExtension<RegistryPeerEntity>[];
  }

  async beforeSaveEntity(entity: Partial<FolderEntity>): Promise<Partial<FolderEntity>> {
    let result = { ...entity };

    for (const ext of this.getExtensionsInOrder()) {
      if (ext.entity?.beforeSave) {
        result = await ext.entity.beforeSave(result);
      }
    }

    return result;
  }

  async afterLoadEntity(entity: FolderEntity): Promise<FolderEntity> {
    let result = { ...entity };

    for (const ext of this.getExtensionsInOrder()) {
      if (ext.entity?.afterLoad) {
        result = await ext.entity.afterLoad(result);
      }
    }

    return result;
  }

  async validateEntity(entity: Partial<FolderEntity>): Promise<string[]> {
    const errors: string[] = [];

    for (const ext of this.getExtensionsInOrder()) {
      if (ext.entity?.validateEntity) {
        const extErrors = await ext.entity.validateEntity(entity);
        errors.push(...extErrors);
      }
    }

    return errors;
  }

  async executeAfterCreate(node: TreeNode, entity: FolderEntity): Promise<void> {
    for (const ext of this.getExtensionsInOrder()) {
      await ext.lifecycle?.afterCreate?.(node, entity);
    }
  }

  async executeBeforeUpdate(
    node: TreeNode,
    entity: FolderEntity,
    changes: Partial<FolderEntity>,
  ): Promise<void> {
    for (const ext of this.getExtensionsInOrder()) {
      await ext.lifecycle?.beforeUpdate?.(node, entity, changes);
    }
  }

  async executeAfterUpdate(node: TreeNode, entity: FolderEntity): Promise<void> {
    for (const ext of this.getExtensionsInOrder()) {
      await ext.lifecycle?.afterUpdate?.(node, entity);
    }
  }

  async executeBeforeDelete(node: TreeNode, entity: FolderEntity): Promise<void> {
    for (const ext of this.getExtensionsInOrder()) {
      await ext.lifecycle?.beforeDelete?.(node, entity);
    }
  }

  buildExtensionConfig() {
    const extensions = this.getExtensionsInOrder();

    let createSteps: DialogStepDefinition[] = [];
    const editSteps: DialogStepDefinition[] = [];
    let combinedValidation: ValidationExtension | undefined;
    let combinedEntity: FolderEntityExtension | undefined;

    for (const ext of extensions) {
      if (ext.dialog?.createSteps) {
        createSteps.push(...ext.dialog.createSteps);
      }
      if (ext.dialog?.editSteps) {
        editSteps.push(...ext.dialog.editSteps);
      }
      if (ext.dialog?.validation) {
        combinedValidation = ext.dialog.validation;
      }
      if (ext.entity) {
        combinedEntity = ext.entity;
      }
    }

    const config = {
      dialog: {
        createSteps: createSteps.length > 0 ? createSteps : undefined,
        editSteps: editSteps.length > 0 ? editSteps : undefined,
      },
      validation: combinedValidation,
      entity: combinedEntity,
      metadata: {
        id: 'folder-plugin-extension-combined',
        name: 'Combined Folder Extensions',
        version: '1.0.0',
        description: 'Combined configuration from all folder-plugin extensions',
        dependencies: extensions.flatMap((ext) => ext.metadata.dependencies || []),
      },
    };

    return config;
  }

  createExtendableDefinition(
    baseDefinition: ExtendingNodeTypeDefinition,
  ): ExtendingNodeTypeDefinition {
    const config = this.buildExtensionConfig();
    const extensions = this.getExtensionsInOrder();

    return {
      extends: baseDefinition.extends,
      nodeType: baseDefinition.nodeType,
      name: baseDefinition.name,
      displayName: baseDefinition.displayName,
      extendedSteps: config.dialog?.createSteps || config.dialog?.editSteps,
      extendedFields: extensions
        .flatMap((ext) => ext.metadata.dependencies || [])
        .map((dep) => ({
          name: dep,
          type: 'string',
          required: false,
        })),
      extendedValidation: config.validation,
      baseDefinition: baseDefinition.baseDefinition,
    };
  }
}

// export const folderExtensionRegistry = new FolderExtensionRegistry(baseNodeDialogRegistry);

/**
 * @deprecated Use `folderExtensionRegistry` instead.
 */
// export const nodeDialogExtensionRegistry = folderExtensionRegistry;

/**
 * @deprecated Prefer importing from `@hierarchidb/base-plugin` directly.
 */
// export const dialogExtensionRegistry = deprecatedDialogRegistry;

export function createFolderExtension<TDialog extends PeerEntity = PeerEntity>(config: {
  id: string;
  name: string;
  description?: string;
  version: string;
  dependencies?: string[];
  dialog?: FolderDialogHooks<TDialog>;
  entity?: FolderEntityExtension;
  lifecycle?: FolderExtension<TDialog>['lifecycle'];
}): FolderExtension<TDialog> {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    metadata: {
      id: config.id,
      name: config.name,
      version: config.version,
      dependencies: config.dependencies || [],
      description: config.description,
    },
    dialog: config.dialog,
    entity: config.entity,
    lifecycle: config.lifecycle,
  };
}
