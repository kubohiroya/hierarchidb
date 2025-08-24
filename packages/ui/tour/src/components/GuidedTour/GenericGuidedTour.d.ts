import type { CallBackProps, Step } from 'react-joyride';
export interface GenericGuidedTourProps {
  run: boolean;
  onFinish?: () => void;
  steps: Step[];
  tourType?: string;
  callback?: (data: CallBackProps) => void;
  stepIndex?: number;
}
export declare const GenericGuidedTour: ({
  run,
  onFinish,
  steps,
  tourType,
  callback,
  stepIndex: controlledStepIndex,
}: GenericGuidedTourProps) => import('react/jsx-runtime').JSX.Element;
//# sourceMappingURL=GenericGuidedTour.d.ts.map
