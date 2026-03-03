import { useCallback, useId, useState } from 'react';

export interface UseGuidedTourDemoViewResult {
  runTour: boolean;
  buttonId: string;
  contentId: string;
  startTour: () => void;
  finishTour: () => void;
}

export function useGuidedTourDemoView(): UseGuidedTourDemoViewResult {
  const [runTour, setRunTour] = useState(true);
  const buttonId = useId();
  const contentId = useId();

  const startTour = useCallback(() => {
    setRunTour(true);
  }, []);

  const finishTour = useCallback(() => {
    setRunTour(false);
  }, []);

  return {
    runTour,
    buttonId,
    contentId,
    startTour,
    finishTour,
  };
}
