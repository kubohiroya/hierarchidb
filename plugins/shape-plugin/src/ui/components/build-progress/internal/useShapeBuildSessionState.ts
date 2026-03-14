import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue } from 'jotai';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { buildSessionLifecycleAtom } from '~/ui/atoms/buildSessionStateAtoms';

type UseShapeBuildSessionStateArgs = {
    activeNodeId: NodeId | null;
};

type UseShapeBuildSessionStateResult = {
    updateSessionRecord: (patch: Partial<ShapeBuildSessionRecord>) => Promise<boolean>;
};

export const useShapeBuildSessionState = ({
    activeNodeId,
}: UseShapeBuildSessionStateArgs): UseShapeBuildSessionStateResult => {
    const [isRuntimeReady, setIsRuntimeReady] = useState(false);
    const lastWorkerStageTraceKeyRef = useRef<string | null>(null);
    const runtime = useAtomValue(buildSessionLifecycleAtom);

    const updateSessionRecord = useCallback(async (patch: Partial<ShapeBuildSessionRecord>): Promise<boolean> => {
        if (!activeNodeId) return false;
        if (Object.keys(patch).length === 0) return true;
        try {
            await shapeMutationAPIImpl.updateBuildSession(activeNodeId, patch);
            return true;
        } catch (error) {
            console.warn('[ShapeBuildSessionState] failed to update build session record', error);
            return false;
        }
    }, [activeNodeId]);

    // Runtime state availability marker.
    useEffect(() => {
        if (!activeNodeId) {
            setIsRuntimeReady(false);
            return;
        }
        shapeQueryAPIImpl.getBuildSessionRecord(activeNodeId)
            .then(() => setIsRuntimeReady(true))
            .catch((error) => {
                console.warn('[ShapeBuildSessionState] Failed to probe session record', error);
                setIsRuntimeReady(true);
            });
    }, [activeNodeId]);

    // Browser reload state consistency check
    useEffect(() => {
        if (!activeNodeId || !isRuntimeReady) return;

        const checkStateConsistency = () => {
            try {
                const storage = window.localStorage;
                const storedAutoResume = storage?.getItem('autoResumeBuild');

                if (storedAutoResume && storedAutoResume === String(activeNodeId)) {
                    if (runtime.phase === 'completed' || runtime.phase === 'failed') {
                        console.log('[ShapeBuildSessionState] Removing stale autoResumeBuild flag');
                        storage?.removeItem('autoResumeBuild');
                    }
                }
            } catch (error) {
                console.warn('[ShapeBuildSessionState] Failed to check state consistency', error);
            }
        };

        checkStateConsistency();
    }, [activeNodeId, isRuntimeReady, runtime.phase]);

    // Debug logging
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const activeNodeIdText = activeNodeId ? String(activeNodeId) : null;
        const stageId = runtime.activeStageId ?? null;
        const status = runtime.phase;
        const stageHeartbeatAt = runtime.heartbeatAt ?? null;
        const key = `${activeNodeIdText ?? '-'}:${status ?? '-'}:${stageId ?? '-'}:${stageHeartbeatAt ?? '-'}`;
        if (lastWorkerStageTraceKeyRef.current === key) return;
        lastWorkerStageTraceKeyRef.current = key;
        if (!activeNodeIdText) return;
        console.log('[ShapeBuildWorkerStageTrace]', {
            nodeId: activeNodeIdText,
            status,
            stageId,
            stageHeartbeatAt,
            isRuntimeReady,
        });
    }, [
        activeNodeId,
        runtime.heartbeatAt,
        runtime.phase,
        runtime.activeStageId,
        isRuntimeReady,
    ]);

    return {
        updateSessionRecord,
    };
};
