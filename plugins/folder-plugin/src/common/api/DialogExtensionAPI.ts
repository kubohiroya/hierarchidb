import { BaseEntityExtension, ExtendingNodeTypeDefinition, NodeDialogStepDefinition, ValidationExtension } from '@hierarchidb/plugin-types';
import type { FolderEntity } from '../types/FolderEntity.js';
import { TreeNode } from '@hierarchidb/common-types';

/**
 * Lightweight evaluator interface for folder-plugin extensions.
 * Mirrors ui-dialog's StepStateEvaluator but stays local to avoid tight coupling.
 */
export interface StepArrayEvaluator {
  getEnabledSteps?: (data: any, stepNumbers?: number[]) => boolean[];
  getValidatedSteps?: (data: any, stepNumbers?: number[]) => boolean[];
}

/**
 * Generic, folder-agnostic alias. Prefer this name in new code.
 */
export type NodeDialogStepEvaluator = StepArrayEvaluator;

export interface NodeDialogExtension {
  /**
   * Additional steps for create base-dialog
   */
  createSteps?: NodeDialogStepDefinition[];

  /**
   * Additional steps for edit base-dialog
   */
  editSteps?: NodeDialogStepDefinition[];

  /**
   * Transform data before submission
   */
  transformData?: (data: Record<string, any>) => Record<string, any>;

  /**
   * Custom validation rules
   */
  validation?: ValidationExtension;

  /**
   * Optional step state evaluator supplied by the extension.
   * When multiple extensions provide evaluators, they are combined conservatively (AND).
   */
  evaluateSteps?: StepArrayEvaluator;

  /**
   * Optional submit-eligibility function supplied by the extension.
   * Multiple providers are AND-composed.
   */
  canSubmit?: (data: any) => boolean | Promise<boolean>;
}

/**
 * Extension point for folder-plugin entity handling
 */
export interface FolderEntityExtension extends BaseEntityExtension<FolderEntity> {
  /**
   * Additional fields to store with folder-plugin entity
   */
  additionalFields?: string[];

  /**
   * Transform entity before saving
   */
  beforeSave?: (entity: Partial<FolderEntity>) => Promise<Partial<FolderEntity>>;

  /**
   * Transform entity after loading
   */
  afterLoad?: (entity: FolderEntity) => Promise<FolderEntity>;

  /**
   * Custom entity validation
   */
  validateEntity?: (entity: Partial<FolderEntity>) => Promise<string[]>;
}

/**
 * Complete folder-plugin extension configuration
 */
export interface FolderExtension {
  /**
   * Unique identifier for the extension
   */
  id: string;

  /**
   * Display name for the extension
   */
  name: string;

  /**
   * Description of what the extension adds
   */
  description?: string;

  /**
   * Extension metadata
   */
  metadata: {
    id: string;
    name: string;
    version: string;
    description?: string;
    dependencies?: string[];
  };

  /**
   * Dialog extensions
   */
  dialog?: NodeDialogExtension;

  /**
   * Entity handler extensions
   */
  entity?: FolderEntityExtension;

  /**
   * Lifecycle hooks
   */
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

/**
 * Registry for folder-plugin extensions
 */
export class FolderExtensionRegistry {
  private static instance: FolderExtensionRegistry | null = null;
  private extensions: Map<string, FolderExtension> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  /**
   * Get singleton instance
   */
  static getInstance(): FolderExtensionRegistry {
    if (!FolderExtensionRegistry.instance) {
      FolderExtensionRegistry.instance = new FolderExtensionRegistry();
    }
    return FolderExtensionRegistry.instance;
  }

  /**
   * Reset instance (mainly for testing)
   */
  static resetInstance(): void {
    FolderExtensionRegistry.instance = null;
  }

  /**
   * Register a folder-plugin extension
   */
  register(extension: FolderExtension): void {
    // Check for circular dependencies
    if (this.wouldCreateCircularDependency(extension)) {
      throw new Error(`Circular dependency detected when registering extension: ${extension.id}`);
    }

    // Validate dependencies exist
    const dependencies = extension.metadata.dependencies || [];
    for (const dep of dependencies) {
      if (!this.extensions.has(dep)) {
        throw new Error(`Extension ${extension.id} depends on ${dep}, which is not registered`);
      }
    }

    // Register extension
    this.extensions.set(extension.id, extension);

    // Update dependency graph
    this.updateDependencyGraph(extension);
  }

  /**
   * Unregister a folder-plugin extension
   */
  unregister(extensionId: string): void {
    // Check if other extensions depend on this one
    const dependents = this.getDependents(extensionId);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister ${extensionId}, the following extensions depend on it: ${dependents.join(', ')}`,
      );
    }

    this.extensions.delete(extensionId);
    this.dependencyGraph.delete(extensionId);
  }

  /**
   * Get all registered extensions
   */
  getAllExtensions(): FolderExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get extension by ID
   */
  getExtension(id: string): FolderExtension | undefined {
    return this.extensions.get(id);
  }

  /**
   * Get extensions in dependency order
   */
  getExtensionsInOrder(): FolderExtension[] {
    const visited = new Set<string>();
    const result: FolderExtension[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const extension = this.extensions.get(id);
      if (!extension) return;

      // Visit dependencies first
      const dependencies = extension.metadata.dependencies || [];
      for (const dep of dependencies) {
        visit(dep);
      }

      result.push(extension);
    };

    // Visit all extensions
    for (const id of this.extensions.keys()) {
      visit(id);
    }

    return result;
  }

  /**
   * Get all base-dialog steps for create mode
   */
  getCreateDialogSteps(): NodeDialogStepDefinition[] {
    const steps: NodeDialogStepDefinition[] = [];
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.createSteps) {
        steps.push(...ext.dialog.createSteps);
      }
    }

    // Sort by stepNumber property
    return steps.sort((a, b) => a.stepNumber - b.stepNumber);
  }

  /**
   * Get all base-dialog steps for edit mode
   */
  getEditDialogSteps(): NodeDialogStepDefinition[] {
    const steps: NodeDialogStepDefinition[] = [];
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.editSteps) {
        steps.push(...ext.dialog.editSteps);
      }
    }

    // Sort by stepNumber property
    return steps.sort((a, b) => a.stepNumber - b.stepNumber);
  }

  /**
   * Get all dialog evaluators registered by extensions (dependency order).
   */
  getDialogEvaluators(): StepArrayEvaluator[] {
    const evaluators: StepArrayEvaluator[] = [];
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.evaluateSteps) {
        evaluators.push(ext.dialog.evaluateSteps);
      }
    }

    return evaluators;
  }

  /**
   * Get all submit-eligibility evaluators registered by extensions.
   */
  getSubmitEvaluators(): Array<(data: any) => boolean | Promise<boolean>> {
    const result: Array<(data: any) => boolean | Promise<boolean>> = [];
    const extensions = this.getExtensionsInOrder();
    for (const ext of extensions) {
      if (ext.dialog?.canSubmit) result.push(ext.dialog.canSubmit);
    }
    return result;
  }

  /**
   * Apply all data transformations
   */
  async transformData(data: Record<string, any>): Promise<Record<string, any>> {
    let result = { ...data };
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.transformData) {
        result = ext.dialog.transformData(result);
      }
    }

    return result;
  }

  /**
   * Apply all entity transformations before save
   */
  async beforeSaveEntity(entity: Partial<FolderEntity>): Promise<Partial<FolderEntity>> {
    let result = { ...entity };
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.entity?.beforeSave) {
        result = await ext.entity.beforeSave(result);
      }
    }

    return result;
  }

  /**
   * Apply all entity transformations after load
   */
  async afterLoadEntity(entity: FolderEntity): Promise<FolderEntity> {
    let result = { ...entity };
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.entity?.afterLoad) {
        result = await ext.entity.afterLoad(result);
      }
    }

    return result;
  }

  /**
   * Validate entity with all extensions
   */
  async validateEntity(entity: Partial<FolderEntity>): Promise<string[]> {
    const errors: string[] = [];
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.entity?.validateEntity) {
        const extErrors = await ext.entity.validateEntity(entity);
        errors.push(...extErrors);
      }
    }

    return errors;
  }

  /**
   * Execute lifecycle hook: afterCreate
   */
  async executeAfterCreate(node: TreeNode, entity: FolderEntity): Promise<void> {
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.lifecycle?.afterCreate) {
        await ext.lifecycle.afterCreate(node, entity);
      }
    }
  }

  /**
   * Execute lifecycle hook: beforeUpdate
   */
  async executeBeforeUpdate(
    node: TreeNode,
    entity: FolderEntity,
    changes: Partial<FolderEntity>,
  ): Promise<void> {
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.lifecycle?.beforeUpdate) {
        await ext.lifecycle.beforeUpdate(node, entity, changes);
      }
    }
  }

  /**
   * Execute lifecycle hook: afterUpdate
   */
  async executeAfterUpdate(node: TreeNode, entity: FolderEntity): Promise<void> {
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.lifecycle?.afterUpdate) {
        await ext.lifecycle.afterUpdate(node, entity);
      }
    }
  }

  /**
   * Execute lifecycle hook: beforeDelete
   */
  async executeBeforeDelete(node: TreeNode, entity: FolderEntity): Promise<void> {
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.lifecycle?.beforeDelete) {
        await ext.lifecycle.beforeDelete(node, entity);
      }
    }
  }

  /**
   * Build plugin extension config from registered extensions
   */
  buildExtensionConfig() {
    const extensions = this.getExtensionsInOrder();

    // Combine all base-dialog steps from extensions
    const createSteps: NodeDialogStepDefinition[] = [];
    const editSteps: NodeDialogStepDefinition[] = [];
    let combinedValidation: ValidationExtension | undefined;
    let combinedEntity: BaseEntityExtension<any> | undefined;

    for (const ext of extensions) {
      // Collect base-dialog steps
      if (ext.dialog?.createSteps) {
        createSteps.push(...ext.dialog.createSteps);
      }
      if (ext.dialog?.editSteps) {
        editSteps.push(...ext.dialog.editSteps);
      }

      // Use the last validation extension (could be combined in future)
      if (ext.dialog?.validation) {
        combinedValidation = ext.dialog.validation;
      }

      // Use the last entity extension (could be combined in future)
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

  /**
   * Create an ExtendingNodeTypeDefinition from the base folder-plugin definition and extensions
   */
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

  // Private helper methods

  private wouldCreateCircularDependency(extension: FolderExtension): boolean {
    const dependencies = extension.metadata.dependencies || [];

    for (const dep of dependencies) {
      if (this.hasPathTo(dep, extension.id)) {
        return true;
      }
    }

    return false;
  }

  private hasPathTo(from: string, to: string): boolean {
    if (from === to) return true;

    const visited = new Set<string>();
    const queue = [from];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = this.dependencyGraph.get(current) || new Set();
      if (deps.has(to)) return true;

      queue.push(...deps);
    }

    return false;
  }

  private updateDependencyGraph(extension: FolderExtension): void {
    const dependencies = extension.metadata.dependencies || [];
    this.dependencyGraph.set(extension.id, new Set(dependencies));
  }

  private getDependents(extensionId: string): string[] {
    const dependents: string[] = [];

    for (const [id, deps] of this.dependencyGraph.entries()) {
      if (deps.has(extensionId)) {
        dependents.push(id);
      }
    }

    return dependents;
  }
}

// Folder-agnostic aliases (types/values)
export { FolderExtensionRegistry as NodeDialogExtensionRegistry };
export const nodeDialogExtensionRegistry = FolderExtensionRegistry.getInstance();

/**
 * Helper function to create a folder-plugin extension
 */
export function createFolderExtension(config: {
  id: string;
  name: string;
  description?: string;
  version: string;
  dependencies?: string[];
  dialog?: NodeDialogExtension;
  entity?: FolderEntityExtension;
  lifecycle?: FolderExtension['lifecycle'];
}): FolderExtension {
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

// Export singleton instance
export const folderExtensionRegistry = FolderExtensionRegistry.getInstance();
