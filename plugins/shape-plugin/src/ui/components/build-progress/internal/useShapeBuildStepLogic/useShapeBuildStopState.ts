import { useEffect, useState, useRef, useCallback } from 'react';
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

  // 手動リセット機能
  const forceResetStopState = useCallback(() => {
    console.log('[ShapeBuildStopState] Force resetting stop state');
    setIsStopRequested(false);
    setIsStopAccepted(false);
    if (forceResetTimerRef.current) {
      clearTimeout(forceResetTimerRef.current);
      forceResetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isStopRequestedInFlight) return;

    // セッション状態が更新されたら状態をリセット
    if (
      sessionRecord?.status === 'paused'
      || sessionRecord?.status === 'completed'
      || sessionRecord?.status === 'failed'
    ) {
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
      forceResetTimerRef.current = setTimeout(() => {
        console.warn('[ShapeBuildStopState] Force resetting stop state due to timeout');
        setIsStopRequested(false);
        setIsStopAccepted(false);
        forceResetTimerRef.current = null;
      }, 30000); // 30秒
    }
  }, [isStopRequestedInFlight, sessionRecord?.status]);

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
    forceResetStopState,
  };
};
