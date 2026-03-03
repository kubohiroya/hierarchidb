import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import type { NodeId } from '@hierarchidb/core-types';

type UseShapeBuildSessionRecordArgs = {
  activeNodeId: NodeId | null;
};

type UseShapeBuildSessionRecordResult = {
  sessionRecord: ShapeBuildSessionRecord | null;
  refreshSessionRecord: () => Promise<ShapeBuildSessionRecord | null>;
  updateSessionRecord: (patch: Partial<ShapeBuildSessionRecord>) => Promise<boolean>;
  isInitialLoadComplete: boolean;
  forceRefresh: () => Promise<void>;
};

export const useShapeBuildSessionRecord = ({
  activeNodeId,
}: UseShapeBuildSessionRecordArgs): UseShapeBuildSessionRecordResult => {
  const [sessionRecord, setSessionRecord] = useState<ShapeBuildSessionRecord | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const lastWorkerStageTraceKeyRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  const refreshSessionRecord = useCallback(async () => {
    if (!activeNodeId) {
      setSessionRecord(null);
      setIsInitialLoadComplete(true);
      return null;
    }

    if (isLoadingRef.current) {
      return sessionRecord; // 既に読み込み中の場合は現在の値を返す
    }

    isLoadingRef.current = true;
    try {
      const next = await shapeQueryAPIImpl.getBuildSessionRecord(activeNodeId).catch((error) => {
        console.warn('[ShapeBuildSessionRecord] Failed to fetch session record', error);
        return null;
      });
      setSessionRecord(next);
      setIsInitialLoadComplete(true);
      return next;
    } finally {
      isLoadingRef.current = false;
    }
  }, [activeNodeId, sessionRecord]);

  const forceRefresh = useCallback(async () => {
    if (!activeNodeId) return;

    console.log('[ShapeBuildSessionRecord] Force refreshing session record');
    isLoadingRef.current = false; // 強制的にリセット
    await refreshSessionRecord();
  }, [activeNodeId, refreshSessionRecord]);

  const updateSessionRecord = useCallback(async (patch: Partial<ShapeBuildSessionRecord>): Promise<boolean> => {
    if (!activeNodeId) return false;
    if (Object.keys(patch).length === 0) return true;
    try {
      await shapeMutationAPIImpl.updateBuildSession(activeNodeId, patch);
      setSessionRecord((current) => {
        if (!current) return current;
        return {
          ...current,
          ...patch,
          updatedAt: Date.now(),
        };
      });
      return true;
    } catch (error) {
      console.warn('[ShapeBuildProgressStep] failed to update build session record', error);
      return false;
    }
  }, [activeNodeId]);

  // 初期読み込み（ポーリング削除）
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await refreshSessionRecord();
    };

    // 初回読み込みのみ
    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshSessionRecord]);

  // ブラウザリロード時の状態確認
  useEffect(() => {
    if (!activeNodeId || !isInitialLoadComplete) return;

    // localStorage の autoResumeBuild と実際のセッション状態の整合性をチェック
    const checkStateConsistency = () => {
      try {
        const storage = window.localStorage;
        const storedAutoResume = storage?.getItem('autoResumeBuild');

        if (storedAutoResume && storedAutoResume === String(activeNodeId)) {
          // autoResumeBuild が設定されているが、セッション状態を確認
          if (sessionRecord?.status === 'completed' || sessionRecord?.status === 'failed') {
            console.log('[ShapeBuildSessionRecord] Removing stale autoResumeBuild flag');
            storage?.removeItem('autoResumeBuild');
          }
        }
      } catch (error) {
        console.warn('[ShapeBuildSessionRecord] Failed to check state consistency', error);
      }
    };

    checkStateConsistency();
  }, [activeNodeId, isInitialLoadComplete, sessionRecord?.status]);

  // デバッグログ
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const activeNodeIdText = activeNodeId ? String(activeNodeId) : null;
    const stageId = sessionRecord?.stageId ?? null;
    const status = sessionRecord?.status ?? null;
    const stageHeartbeatAt = sessionRecord?.stageHeartbeatAt ?? null;
    const updatedAt = sessionRecord?.updatedAt ?? null;
    const key = `${activeNodeIdText ?? '-'}:${status ?? '-'}:${stageId ?? '-'}:${stageHeartbeatAt ?? '-'}`;
    if (lastWorkerStageTraceKeyRef.current === key) return;
    lastWorkerStageTraceKeyRef.current = key;
    if (!activeNodeIdText) return;
    console.log('[ShapeBuildWorkerStageTrace]', {
      nodeId: activeNodeIdText,
      status,
      stageId,
      stageHeartbeatAt,
      updatedAt,
      isInitialLoadComplete,
    });
  }, [
    activeNodeId,
    sessionRecord?.stageHeartbeatAt,
    sessionRecord?.stageId,
    sessionRecord?.status,
    sessionRecord?.updatedAt,
    isInitialLoadComplete,
  ]);

  return {
    sessionRecord,
    refreshSessionRecord,
    updateSessionRecord,
    isInitialLoadComplete,
    forceRefresh,
  };
};
