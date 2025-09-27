import type { PeerEntity } from '@hierarchidb/common-type';
import type {
  NodeDialogExtension,
  NodeDialogExtensionMetadata,
  NodeDialogHooks,
  StepArrayEvaluator,
} from './NodeDialogExtensionAPI.js';
import { nodeDialogExtensionRegistry } from './NodeDialogExtensionAPI.js';

/**
 * Base class for dialog-based plugins that register extensions in the node dialog registry.
 * Framework-agnostic: subclasses provide concrete step definitions and metadata.
 */
export abstract class NodeDialogPlugin<TDialog extends PeerEntity = PeerEntity> {
  /** Unique plugin identifier */
  abstract readonly pluginId: string;
  /** Human readable plugin name */
  abstract readonly pluginName: string;
  /** Description */
  abstract readonly pluginDescription: string;
  /** Semantic version */
  abstract readonly pluginVersion: string;
  /** Other dialog extensions this plugin depends on */
  protected readonly dependencies: string[] = [];

  /** Optional hook executed after registration */
  protected async onInitialize(): Promise<void> {
    // no-op by default
  }

  /** Optional hook executed before unregistration */
  protected async onCleanup(): Promise<void> {
    // no-op by default
  }

  async initialize(): Promise<void> {
    const extension = this.createExtension();
    nodeDialogExtensionRegistry.register(extension);
    await this.onInitialize();
  }

  async cleanup(): Promise<void> {
    await this.onCleanup();
    nodeDialogExtensionRegistry.unregister(this.pluginId);
  }

  protected createExtension(): NodeDialogExtension<TDialog> {
    return {
      id: this.pluginId,
      name: this.pluginName,
      description: this.pluginDescription,
      metadata: this.getMetadata(),
      dialog: this.createDialogHooks(),
    };
  }

  protected getMetadata(): NodeDialogExtensionMetadata {
    return {
      id: this.pluginId,
      name: this.pluginName,
      version: this.pluginVersion,
      description: this.pluginDescription,
      dependencies: this.dependencies,
    };
  }

  protected createDialogHooks(): NodeDialogHooks<TDialog> | undefined {
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

  protected getCreateDialogSteps(): NodeDialogHooks<TDialog>['createSteps'] {
    return undefined;
  }

  protected getEditDialogSteps(): NodeDialogHooks<TDialog>['editSteps'] {
    return undefined;
  }

  protected transformDialogData?(data: TDialog): TDialog;

  protected getValidationExtension(): NodeDialogHooks<TDialog>['validation'] {
    return undefined;
  }

  protected getStepStateEvaluator?(): StepArrayEvaluator<TDialog>;

  protected getSubmitEligibility?(): NodeDialogHooks<TDialog>['canSubmit'];
}

export default NodeDialogPlugin;
