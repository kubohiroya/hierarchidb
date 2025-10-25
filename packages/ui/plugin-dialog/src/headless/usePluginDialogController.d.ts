/**
 * usePluginDialogController – core state machine for plugin dialogs.
 *
 * Coordinates worker access, step composition, navigation rules, and
 * capability evaluation so the headless dialog shell can render plugin-loader with
 * consistent Next/Save guards derived from plugin-provided services.
 */
import React from 'react';
import { HeadlessMultiStepDialogProps, StepComponentDescriptor } from '@hierarchidb/ui-dialog';
import type { DialogStateAPI } from '@hierarchidb/common-api';
import type { DialogStateSubscribeInput, MultiStepDialogState, NodeId, TreeId } from '@hierarchidb/common-types';
import type { PluginDialogFooterPrimaryButtonOptions } from './components/PluginDialogFooter.js';
export interface PluginDialogControllerOptions {
    mode: 'create' | 'edit';
    nodeType: string;
    nodeId: NodeId;
    pageNodeId: NodeId;
    treeId: TreeId;
    open: boolean;
    initialStep?: number;
    onClose: () => void;
    onSuccess?: (nodeId: NodeId) => void;
    footerOptions?: PluginDialogFooterOptions;
}
export interface PluginDialogFooterOptions {
    primaryButtons?: PluginDialogFooterPrimaryButtonOptions;
    saveDraftLabel?: string;
}
export interface PluginDialogControllerState {
    headlessProps: HeadlessMultiStepDialogProps<any>;
    stepDescriptors: ReadonlyArray<StepComponentDescriptor<any>>;
    loading: boolean;
    error: unknown;
    icon?: React.ReactNode;
    presentation?: {
        label: string;
        description?: string;
    };
    hasUnsavedChanges: boolean;
    dialogState?: MultiStepDialogState | null;
}
type DialogStateApiSubset = Partial<Pick<DialogStateAPI, 'subscribeState' | 'unsubscribeState' | 'getState'>>;
type DialogStateSubscriptionLogger = Pick<Console, 'warn'> | undefined;
export interface DialogStateSubscriptionDeps {
    createCallback?: (handler: (state: MultiStepDialogState | null) => void) => unknown;
    releaseCallback?: (callback: unknown) => void;
}
export interface SubscribeDialogStateOptions {
    api: DialogStateApiSubset | null;
    params: DialogStateSubscribeInput;
    onSnapshot: (state: MultiStepDialogState | null) => void;
    logger?: DialogStateSubscriptionLogger;
    deps?: DialogStateSubscriptionDeps;
}
export declare function subscribeDialogState({ api, params, onSnapshot, logger, deps, }: SubscribeDialogStateOptions): Promise<() => void>;
export declare function usePluginDialogController(options: PluginDialogControllerOptions): PluginDialogControllerState;
export {};
//# sourceMappingURL=usePluginDialogController.d.ts.map