export { BasicInfoStep, type BasicInfoValues } from './steps/BasicInfoStep.js';
export { FramesPreviewStep, type TimelineFrame } from './steps/FramesPreviewStep.js';
export { MapPreviewStep } from './steps/MapPreviewStep.js';
export { AnimationViewerStep } from './steps/AnimationViewerStep.js';
export { toFramesFromNodes } from './utils/frames.js';
export { TimelineDialog, getDialogComponent } from './components/TimelineDialog.js';
// Register host-composed steps on import (idempotent)
import './components/steps-provider.js';
