import type { DialogStepDefinition, PeerEntity, ValidationExtension } from '@hierarchidb/common-type';
export interface StepArrayEvaluator<TDialog extends PeerEntity = PeerEntity> {
    getEnabledSteps: (data: TDialog, stepNumbers?: ReadonlyArray<number>) => boolean[];
    getValidatedSteps: (data: TDialog, stepNumbers?: ReadonlyArray<number>) => boolean[];
}
export interface NodeDialogHooks<TDialog extends PeerEntity = PeerEntity> {
    createSteps?: DialogStepDefinition[];
    editSteps?: DialogStepDefinition[];
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
export declare class NodeDialogExtensionRegistry {
    protected extensions: ExtensionMap;
    protected dependencyGraph: DependencyGraph;
    protected static instance: NodeDialogExtensionRegistry | null;
    static getInstance(): NodeDialogExtensionRegistry;
    static resetInstance(): void;
    register<TDialog extends PeerEntity>(extension: NodeDialogExtension<TDialog>): void;
    unregister(extensionId: string): void;
    getAllExtensions(): NodeDialogExtension<RegistryPeerEntity>[];
    getExtension(id: string): NodeDialogExtension<RegistryPeerEntity> | undefined;
    getExtensionsInOrder(): NodeDialogExtension<RegistryPeerEntity>[];
    getCreateDialogSteps(): DialogStepDefinition[];
    getEditDialogSteps(): DialogStepDefinition[];
    getDialogEvaluators(): StepArrayEvaluator<RegistryPeerEntity>[];
    getSubmitEvaluators(): Array<(data: RegistryPeerEntity) => boolean | Promise<boolean>>;
    transformData<TDialog extends PeerEntity>(data: TDialog): Promise<TDialog>;
    protected wouldCreateCircularDependency(extension: NodeDialogExtension<RegistryPeerEntity>): boolean;
    private hasPathTo;
    private updateDependencyGraph;
    private getDependents;
}
export declare const nodeDialogExtensionRegistry: NodeDialogExtensionRegistry;
/**
 * @deprecated Use `NodeDialogExtensionRegistry` / `nodeDialogExtensionRegistry` instead.
 */
export declare const dialogExtensionRegistry: NodeDialogExtensionRegistry;
//# sourceMappingURL=NodeDialogExtensionAPI.d.ts.map