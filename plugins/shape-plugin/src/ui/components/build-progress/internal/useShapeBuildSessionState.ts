import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import type { NodeId } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { SHAPE_NODE_TYPE } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/constants';

type UseShapeBuildSessionStateArgs = {
    activeNodeId: NodeId | null;
};

type UseShapeBuildSessionStateResult = {
    sessionRecord: ShapeBuildSessionRecord | null;
    refreshSessionRecord: () => Promise<ShapeBuildSessionRecord | null>;
    updateSessionRecord: (patch: Partial<ShapeBuildSessionRecord>) => Promise<boolean>;
    isInitialLoadComplete: boolean;
    forceRefresh: () => Promise<void>;
};

/**
 * Real-time session state management using subscription-based approach
 * Replaces polling-based useShapeBuildSessionRecord
 */
export const useShapeBuildSessionState = ({
    activeNodeId,
}: UseShapeBuildSessionStateArgs): UseShapeBuildSessionStateResult => {
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
            return sessionRecord;
        }

        isLoadingRef.current = true;
        try {
            const next = await shapeQueryAPIImpl.getBuildSessionRecord(activeNodeId).catch((error) => {
                console.warn('[ShapeBuildSessionState] Failed to fetch session record', error);
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

        console.log('[ShapeBuildSessionState] Force refreshing session record');
        isLoadingRef.current = false;
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
            console.warn('[ShapeBuildSessionState] failed to update build session record', error);
            return false;
        }
    }, [activeNodeId]);

    // Initial load and real-time subscription setup
    useEffect(() => {
        if (!activeNodeId) {
            setSessionRecord(null);
            setIsInitialLoadComplete(true);
            return;
        }

        let cancelled = false;
        let unsubscribeSessionState: (() => void) | null = null;
        let unsubscribeHeartbeat: (() => void) | null = null;

        const setupSubscriptions = async () => {
            if (cancelled) return;

            try {
                const bridge = getBuildWorkerBridge();
                await bridge.initialize();

                // Initial load
                await refreshSessionRecord();

                if (cancelled) return;

                // Subscribe to session state changes
                unsubscribeSessionState = await bridge.subscribeSessionState(
                    SHAPE_NODE_TYPE,
                    activeNodeId,
                    (event: any) => {
                        if (cancelled) return;
                        console.log('[ShapeBuildSessionState] Session state changed', event);
                        setSessionRecord(event.sessionRecord);
                    }
                );

                // Subscribe to heartbeat for session activity
                unsubscribeHeartbeat = await bridge.subscribeSessionHeartbeat(
                    SHAPE_NODE_TYPE,
                    activeNodeId,
                    (event: any) => {
                        if (cancelled) return;
                        console.log('[ShapeBuildSessionState] Heartbeat received', event);
                        // Update last activity timestamp if needed
                    }
                );
            } catch (error) {
                console.error('[ShapeBuildSessionState] Failed to setup subscriptions', error);
                if (!cancelled) {
                    // Fallback to initial load only
                    await refreshSessionRecord();
                }
            }
        };

        void setupSubscriptions();

        return () => {
            cancelled = true;
            unsubscribeSessionState?.();
            unsubscribeHeartbeat?.();
        };
    }, [activeNodeId, refreshSessionRecord]);

    // Browser reload state consistency check
    useEffect(() => {
        if (!activeNodeId || !isInitialLoadComplete) return;

        const checkStateConsistency = () => {
            try {
                const storage = window.localStorage;
                const storedAutoResume = storage?.getItem('autoResumeBuild');

                if (storedAutoResume && storedAutoResume === String(activeNodeId)) {
                    if (sessionRecord?.status === 'completed' || sessionRecord?.status === 'failed') {
                        console.log('[ShapeBuildSessionState] Removing stale autoResumeBuild flag');
                        storage?.removeItem('autoResumeBuild');
                    }
                }
            } catch (error) {
                console.warn('[ShapeBuildSessionState] Failed to check state consistency', error);
            }
        };

        checkStateConsistency();
    }, [activeNodeId, isInitialLoadComplete, sessionRecord?.status]);

    // Debug logging
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