import type { PeerEntity } from '@hierarchidb/common-type';
import type { NodeDialogExtension, NodeDialogExtensionMetadata, NodeDialogHooks, StepArrayEvaluator } from './NodeDialogExtensionAPI.js';
/**
 * Base class for dialog-based plugins that register extensions in the node dialog registry.
 * Framework-agnostic: subclasses provide concrete step definitions and metadata.
 */
export declare abstract class NodeDialogPlugin<TDialog extends PeerEntity = PeerEntity> {
    /** Unique plugin identifier */
    abstract readonly pluginId: string;
    /** Human readable plugin name */
    abstract readonly pluginName: string;
    /** Description */
    abstract readonly pluginDescription: string;
    /** Semantic version */
    abstract readonly pluginVersion: string;
    /** Other dialog extensions this plugin depends on */
    protected readonly dependencies: string[];
    /** Optional hook executed after registration */
    protected onInitialize(): Promise<void>;
    /** Optional hook executed before unregistration */
    protected onCleanup(): Promise<void>;
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    protected createExtension(): NodeDialogExtension<TDialog>;
    protected getMetadata(): NodeDialogExtensionMetadata;
    protected createDialogHooks(): NodeDialogHooks<TDialog> | undefined;
    protected getCreateDialogSteps(): NodeDialogHooks<TDialog>['createSteps'];
    protected getEditDialogSteps(): NodeDialogHooks<TDialog>['editSteps'];
    protected transformDialogData?(data: TDialog): TDialog;
    protected getValidationExtension(): NodeDialogHooks<TDialog>['validation'];
    protected getStepStateEvaluator?(): StepArrayEvaluator<TDialog>;
    protected getSubmitEligibility?(): NodeDialogHooks<TDialog>['canSubmit'];
}
export default NodeDialogPlugin;
//# sourceMappingURL=NodeDialogPlugin.d.ts.map