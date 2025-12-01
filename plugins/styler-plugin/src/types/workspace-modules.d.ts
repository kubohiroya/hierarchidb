declare module '@hierarchidb/ui-worker-provider' {
  export { getWorkerClientHook, type WorkerClientRef } from '../../../packages/runtime-worker/client/src/index.js';
}

declare module '@hierarchidb/ui-dialog' {
  export {
    HeadlessMultiStepDialog,
    FRAME_CONSTANTS,
    getViewportSize,
    getPresetSize,
    normalizeDialogState,
    initialPosition,
    sizesEqual,
    positionsEqual,
    type DialogDisplayMode,
    type MultiDialogPosition,
    type MultiDialogSize,
    type StepNavigationEvent,
    type HeadlessMultiStepDialogProps,
  } from '../../../packages/ui/dialog/src/index.js';
}

declare module '@hierarchidb/ui-plugin-basic-info' {
  export { BasicInfoStep, type BasicInfoData, TagChipsInput } from '../../../packages/ui/plugin-basic-info/src/index.js';
}

declare module '@hierarchidb/plugin-ui-sdk' {
  export {
    useDialogDraft,
    type DraftData,
    NodeDialogPlugin,
    type NodeDialogStepDefinition,
    wrapDialogStepComponent,
  } from '../../../packages/plugin-ui-sdk/src/index.js';
}
