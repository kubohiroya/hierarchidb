import { useEffect, useState } from 'react';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';

type UseShapeBuildStopStateArgs = {
  sessionRecord: ShapeBuildSessionRecord | null;
};

export const useShapeBuildStopState = ({ sessionRecord }: UseShapeBuildStopStateArgs) => {
  const [isStopRequested, setIsStopRequested] = useState(false);
  const [isStopAccepted, setIsStopAccepted] = useState(false);
  const isStopRequestedInFlight = isStopRequested || isStopAccepted;
  const isSessionStopping = isStopRequestedInFlight;

  useEffect(() => {
    if (!isStopRequestedInFlight) return;
    if (sessionRecord?.status === 'idle' || sessionRecord?.status === 'paused') {
      setIsStopRequested(false);
      setIsStopAccepted(false);
    }
  }, [isStopRequestedInFlight, sessionRecord?.status]);

  return {
    isStopRequested,
    isStopAccepted,
    setIsStopRequested,
    setIsStopAccepted,
    isStopRequestedInFlight,
    isSessionStopping,
  };
};

