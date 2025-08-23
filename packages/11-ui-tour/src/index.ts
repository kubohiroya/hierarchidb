// Components
export { GenericGuidedTour } from './components/GuidedTour/GenericGuidedTour';
export { GuidedTour } from './components/GuidedTour/GuidedTour';
export { GuidedTourDemo } from './components/GuidedTour/GuidedTourDemo';

// Managers
export { GuidedTourStateManager } from './managers/GuidedTourStateManager';

// Types
export type { GenericGuidedTourProps } from './components/GuidedTour/GenericGuidedTour';

// Re-export react-joyride types with new names to avoid conflicts
import type { Step as ReactJoyrideStep, CallBackProps as ReactJoyrideCallBackProps } from 'react-joyride';
export type TourStep = ReactJoyrideStep;
export type TourCallBackProps = ReactJoyrideCallBackProps;
