import { useMemo } from 'react';
import { useGuidedTourDemoView } from './useGuidedTourDemoView.js';

export const useGuidedTourDemo = () => {
  const { runTour, buttonId, contentId, startTour, finishTour } = useGuidedTourDemoView();

  const stepTargets = useMemo(
    () => ({
      buttonTarget: `#${buttonId}`,
      contentTarget: `#${contentId}`,
    }),
    [buttonId, contentId],
  );

  return {
    runTour,
    buttonId,
    contentId,
    startTour,
    finishTour,
    stepTargets,
  };
};
