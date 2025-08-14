import { jsx as _jsx } from 'react/jsx-runtime';
// import { TopPageGuidedTour } from "@/domains/app-config/guides";
import { GenericGuidedTour } from './GenericGuidedTour';
const TopPageGuidedTour = ({ run, onFinish }) => {
  return _jsx(GenericGuidedTour, {
    run: run,
    onFinish: onFinish,
    steps: [
      {
        target: '.welcome-step',
        content: 'Welcome to HierarchiDB!',
        placement: 'center',
      },
    ],
    tourType: 'welcome',
  });
};
/**
 * Legacy GuidedTour component for backward compatibility.
 * This component is now a wrapper around TopPageGuidedTour.
 *
 * @deprecated Use TopPageGuidedTour directly instead
 */
export const GuidedTour = ({ run, onFinish }) => {
  return _jsx(TopPageGuidedTour, { run: run, onFinish: onFinish });
};
//# sourceMappingURL=GuidedTour.js.map
