import { useCallback, useEffect, useState } from 'react';
import type { ShapeEntity } from '~/common/types/index';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import type { NodeId } from '@hierarchidb/core-types';

type Args = {
  nodeId: string | undefined;
};

export const useShapeBuildConfigStepSession = ({ nodeId }: Args) => {
  const { stepComponents, onStepNavigate } = useDialogContext<Partial<ShapeEntity>>();
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);

  useEffect(() => {
    const resolvedNodeId = nodeId as NodeId | undefined;
    if (!resolvedNodeId) {
      setSessionStatus(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const session = await shapeQueryAPIImpl.getBuildSessionRecord(resolvedNodeId).catch(() => null);
      if (cancelled) return;
      setSessionStatus(session?.status ?? null);
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [nodeId]);

  const buildStepIndex = stepComponents.findIndex((step) => step.id === 'build');
  const handleOpenBuildStep = useCallback(() => {
    if (buildStepIndex < 0) return;
    onStepNavigate({ type: 'direct', targetIndex: buildStepIndex });
  }, [buildStepIndex, onStepNavigate]);

  return {
    buildStepIndex,
    handleOpenBuildStep,
    isBuildRunning: sessionStatus === 'running',
  };
};
