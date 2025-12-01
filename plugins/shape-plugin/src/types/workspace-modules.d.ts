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
  export { BasicInfoStep, type BasicInfoData } from '../../../packages/ui/plugin-basic-info/src/index.js';
}

declare module '@hierarchidb/plugin-ui-sdk' {
  export {
    useDialogDraft,
    type DraftData,
  } from '../../../packages/plugin-ui-sdk/src/index.js';
}
