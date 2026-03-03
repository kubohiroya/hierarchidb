import { useEffect, useState, useRef } from 'react';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';

type UseShapeBuildStopStateArgs = {
  sessionRecord: ShapeBuildSessionRecord | null;
};

export const useShapeBuildStopState = ({ sessionRecord }: UseShapeBuildStopStateArgs) => {
  const [isStopRequested, setIsStopRequested] = useState(false);
  const [isStopAccepted, setIsStopAccepted] = useState(false);
  const isStopRequestedInFlight = isStopRequested || isStopAccepted;
  const isSessionStopping = isStopRequestedInFlight;

  // 強制リセット用のタイマー参照
  const forceResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  useEffect(() => {
    console.log('[ShapeBuildStopState] useEffect triggered', {
      isStopRequestedInFlight,
      sessionStatus: sessionRecord?.status,
      isStopRequested,
      isStopAccepted,
    });

    if (!isStopRequestedInFlight) return;

    // セッション状態が更新されたら状態をリセット
    if (
      sessionRecord?.status === 'paused'
      || sessionRecord?.status === 'completed'
      || sessionRecord?.status === 'failed'
    ) {
      console.log('[ShapeBuildStopState] Resetting stop state due to session status change', {
        sessionStatus: sessionRecord.status,
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
  }, [isStopRequestedInFlight, sessionRecord?.status, isStopRequested, isStopAccepted]);

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
