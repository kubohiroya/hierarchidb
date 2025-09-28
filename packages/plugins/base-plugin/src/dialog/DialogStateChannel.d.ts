/**
 * @file DialogStateChannel.ts
 * @description Shared channel utilities for plugin dialog state updates between worker and runtime UI.
 */
interface DialogStateEventBase {
    nodeType: string;
    dialogId: string;
    timestamp: number;
}
export interface DialogStateProgressEvent extends DialogStateEventBase {
    type: 'progress';
    stepIndex?: number;
    stepId?: string;
    progress?: number;
    status?: 'idle' | 'running' | 'completed' | 'failed';
    message?: string;
    details?: Record<string, unknown>;
}
export interface DialogStateValidationEvent extends DialogStateEventBase {
    type: 'validation';
    stepIndex?: number;
    stepId?: string;
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
    details?: Record<string, unknown>;
}
export interface DialogStateDismissEvent extends DialogStateEventBase {
    type: 'dismiss';
    reason: 'completed' | 'cancelled' | 'error' | 'timeout';
    message?: string;
    details?: Record<string, unknown>;
}
export type DialogStateEvent = DialogStateProgressEvent | DialogStateValidationEvent | DialogStateDismissEvent;
type DialogStateEventWithoutContext<TEvent extends DialogStateEvent> = Omit<TEvent, 'nodeType' | 'dialogId' | 'timestamp'> & {
    timestamp?: number;
};
export type DialogStateEventInput = DialogStateEventWithoutContext<DialogStateProgressEvent> | DialogStateEventWithoutContext<DialogStateValidationEvent> | DialogStateEventWithoutContext<DialogStateDismissEvent>;
export type DialogStateChannelListener = (event: DialogStateEvent) => void;
export interface DialogStateChannelHandle {
    emit: (event: DialogStateEventInput) => void;
    dispose: () => void;
}
export interface SubscribeOptions {
    /**
     * Replay the latest known events immediately after subscribing. Defaults to true.
     */
    replayLatest?: boolean;
}
export declare const registerDialogStateChannel: (nodeType: string, dialogId: string) => DialogStateChannelHandle;
export declare const subscribeDialogStateChannel: (nodeType: string, dialogId: string, listener: DialogStateChannelListener, options?: SubscribeOptions) => () => void;
export declare const emitDialogStateEvent: (nodeType: string, dialogId: string, event: DialogStateEventInput) => DialogStateEvent;
export declare const clearDialogStateChannel: (nodeType: string, dialogId: string) => void;
//# sourceMappingURL=DialogStateChannel.d.ts.map