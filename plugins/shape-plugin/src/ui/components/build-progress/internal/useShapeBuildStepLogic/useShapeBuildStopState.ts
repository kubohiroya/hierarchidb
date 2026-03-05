import { useEffect, useState, useRef } from 'react';
import type { BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';

type UseShapeBuildStopStateArgs = {
  runtimeStatus: BuildProgressStatus['status'];
};

export const useShapeBuildStopState = ({ runtimeStatus }: UseShapeBuildStopStateArgs) => {
  const [isStopRequested, setIsStopRequested] = useState(false);
  const [isStopAccepted, setIsStopAccepted] = useState(false);
  const isStopRequestedInFlight = isStopRequested || isStopAccepted;
  const isSessionStopping = isStopRequestedInFlight;

  // 強制リセット用のタイマー参照
  const forceResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  useEffect(() => {
    console.log('[ShapeBuildStopState] useEffect triggered', {
      isStopRequestedInFlight,
      runtimeStatus,
      isStopRequested,
      isStopAccepted,
    });

    if (!isStopRequestedInFlight) return;

    // セッション状態が更新されたら状態をリセット
    if (
      runtimeStatus === 'paused'
      || runtimeStatus === 'completed'
      || runtimeStatus === 'failed'
    ) {
      console.log('[ShapeBuildStopState] Resetting stop state due to session status change', {
        runtimeStatus,
      });
      setIsStopRequested(false);
      setIsStopAccepted(false);
      if (forceResetTimerRef.current) {
        clearTimeout(forceResetTimerRef.current);
        forceResetTimerRef.current = null;
      }
      return;
    }

    // 30秒後に強制リセット（セッション状態が更新されない場合のフォールバック）
    if (!forceResetTimerRef.current) {
      console.log('[ShapeBuildStopState] Setting timeout for force reset');
      forceResetTimerRef.current = setTimeout(() => {
        console.warn('[ShapeBuildStopState] Force resetting stop state due to timeout');
        setIsStopRequested(false);
        setIsStopAccepted(false);
        forceResetTimerRef.current = null;
      }, 30000); // 30秒
    }
  }, [isStopRequestedInFlight, runtimeStatus, isStopRequested, isStopAccepted]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (forceResetTimerRef.current) {
        clearTimeout(forceResetTimerRef.current);
      }
    };
  }, []);

  return {
    isStopRequested,
    isStopAccepted,
    setIsStopRequested,
    setIsStopAccepted,
    isStopRequestedInFlight,
    isSessionStopping,
  };
};
