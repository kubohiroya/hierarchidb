import type { NodeId } from '@hierarchidb/core-types';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import { useAtomValue } from 'jotai';
import { useCallback } from 'react';
import type { ShapeEntity } from '~/common/types/index';
import { buildSessionLifecycleAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { useShapeBuildSessionStateAtomBridge } from '~/ui/hooks/useShapeBuildSessionStateAtomBridge';

type Args = {
  nodeId: string | undefined;
};

export const useShapeBuildConfigStepSession = ({ nodeId }: Args) => {
  const { stepComponents, onStepNavigate } = useDialogContext<Partial<ShapeEntity>>();
  const lifecycle = useAtomValue(buildSessionLifecycleAtom);
  const resolvedNodeId = nodeId as NodeId | undefined;
  useShapeBuildSessionStateAtomBridge(resolvedNodeId);

  const buildStepIndex = stepComponents.findIndex((step) => step.id === 'build');
  const handleOpenBuildStep = useCallback(() => {
    if (buildStepIndex < 0) return;
    onStepNavigate({ type: 'direct', targetIndex: buildStepIndex });
  }, [buildStepIndex, onStepNavigate]);

  return {
    buildStepIndex,
    handleOpenBuildStep,
    isBuildRunning: lifecycle.isActive,
  };
};
