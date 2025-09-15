export { BasicInfoStep, type BasicInfoValues } from './steps/BasicInfoStep';
export { FramesPreviewStep, type TimelineFrame } from './steps/FramesPreviewStep';
export { MapPreviewStep } from './steps/MapPreviewStep';
export { AnimationViewerStep } from './steps/AnimationViewerStep';
export { toFramesFromNodes } from './utils/frames';
export { TimelineDialog, getDialogComponent } from './TimelineDialog';
// Register host-composed steps on import (idempotent)
import './steps-provider';
