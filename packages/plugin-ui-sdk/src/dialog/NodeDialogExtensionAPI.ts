import type { PeerEntity } from '@hierarchidb/common-types';
import { NodeDialogStepDefinition, ValidationExtension } from '../types/plugin-pointcuts.js';

export interface StepArrayEvaluator<TDialog extends PeerEntity = PeerEntity> {
  getEnabledSteps: (data: TDialog, stepNumbers?: ReadonlyArray<number>) => boolean[];
  getValidatedSteps: (data: TDialog, stepNumbers?: ReadonlyArray<number>) => boolean[];
}

export interface NodeDialogHooks<TDialog extends PeerEntity = PeerEntity> {
  createSteps?: NodeDialogStepDefinition[];
  editSteps?: NodeDialogStepDefinition[];
  transformData?: (data: TDialog) => TDialog;
  evaluateSteps?: StepArrayEvaluator<TDialog>;
  validation?: ValidationExtension;
  canSubmit?: (data: TDialog) => boolean | Promise<boolean>;
}

export interface NodeDialogExtensionMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
}

export interface NodeDialogExtension<TDialog extends PeerEntity = PeerEntity> {
  id: string;
  name: string;
  description?: string;
  metadata: NodeDialogExtensionMetadata;
  dialog?: NodeDialogHooks<TDialog>;
}

type RegistryPeerEntity = PeerEntity<Record<string, unknown>>;

type ExtensionMap = Map<string, NodeDialogExtension<RegistryPeerEntity>>;

type DependencyGraph = Map<string, Set<string>>;

export class NodeDialogExtensionRegistry {
  protected extensions: ExtensionMap = new Map();
  protected dependencyGraph: DependencyGraph = new Map();

  protected static instance: NodeDialogExtensionRegistry | null = null;

  static getInstance(): NodeDialogExtensionRegistry {
    if (!NodeDialogExtensionRegistry.instance) {
      NodeDialogExtensionRegistry.instance = new NodeDialogExtensionRegistry();
    }
    return NodeDialogExtensionRegistry.instance;
  }

  static resetInstance(): void {
    NodeDialogExtensionRegistry.instance = null;
  }

  register<TDialog extends PeerEntity>(extension: NodeDialogExtension<TDialog>): void {
    const registryEntry = extension as unknown as NodeDialogExtension<RegistryPeerEntity>;

    if (this.wouldCreateCircularDependency(registryEntry)) {
      throw new Error(`Circular dependency detected when registering extension: ${extension.id}`);
    }

    const dependencies = registryEntry.metadata.dependencies || [];
    for (const dep of dependencies) {
      if (!this.extensions.has(dep)) {
        throw new Error(`Extension ${extension.id} depends on ${dep}, which is not registered`);
      }
    }

    this.extensions.set(extension.id, registryEntry);
    this.updateDependencyGraph(registryEntry);
  }

  unregister(extensionId: string): void {
    const dependents = this.getDependents(extensionId);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister ${extensionId}, the following extensions depend on it: ${dependents.join(', ')}`,
      );
    }

    this.extensions.delete(extensionId);
    this.dependencyGraph.delete(extensionId);
  }

  getAllExtensions(): NodeDialogExtension<RegistryPeerEntity>[] {
    return Array.from(this.extensions.values());
  }

  getExtension(id: string): NodeDialogExtension<RegistryPeerEntity> | undefined {
    return this.extensions.get(id);
  }

  getExtensionsInOrder(): NodeDialogExtension<RegistryPeerEntity>[] {
    const visited = new Set<string>();
    const result: NodeDialogExtension<RegistryPeerEntity>[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const extension = this.extensions.get(id);
      if (!extension) return;

      const dependencies = extension.metadata.dependencies || [];
      for (const dep of dependencies) {
        visit(dep);
      }

      result.push(extension);
    };

    for (const id of this.extensions.keys()) {
      visit(id);
    }

    return result;
  }

  getCreateDialogSteps(): NodeDialogStepDefinition[] {
    const steps: NodeDialogStepDefinition[] = [];
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.createSteps) {
        steps.push(...ext.dialog.createSteps);
      }
    }

    return steps.sort((a, b) => a.stepNumber - b.stepNumber);
  }

  getEditDialogSteps(): NodeDialogStepDefinition[] {
    const steps: NodeDialogStepDefinition[] = [];
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.editSteps) {
        steps.push(...ext.dialog.editSteps);
      }
    }

    return steps.sort((a, b) => a.stepNumber - b.stepNumber);
  }

  getDialogEvaluators(): StepArrayEvaluator<RegistryPeerEntity>[] {
    const evaluators: StepArrayEvaluator<RegistryPeerEntity>[] = [];
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.evaluateSteps) {
        evaluators.push(ext.dialog.evaluateSteps);
      }
    }

    return evaluators;
  }

  getSubmitEvaluators(): Array<(data: RegistryPeerEntity) => boolean | Promise<boolean>> {
    const result: Array<(data: RegistryPeerEntity) => boolean | Promise<boolean>> = [];
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.canSubmit) {
        result.push(ext.dialog.canSubmit);
      }
    }

    return result;
  }

  async transformData<TDialog extends PeerEntity>(data: TDialog): Promise<TDialog> {
    let result: RegistryPeerEntity = { ...data } as RegistryPeerEntity;
    const extensions = this.getExtensionsInOrder();

    for (const ext of extensions) {
      if (ext.dialog?.transformData) {
        result = ext.dialog.transformData(result as RegistryPeerEntity);
      }
    }

    return result as TDialog;
  }

  protected wouldCreateCircularDependency(extension: NodeDialogExtension<RegistryPeerEntity>): boolean {
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

  private updateDependencyGraph(extension: NodeDialogExtension<RegistryPeerEntity>): void {
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

export const nodeDialogExtensionRegistry = NodeDialogExtensionRegistry.getInstance();

/**
 * @deprecated Use `NodeDialogExtensionRegistry` / `nodeDialogExtensionRegistry` instead.
 */
export const dialogExtensionRegistry = nodeDialogExtensionRegistry;
