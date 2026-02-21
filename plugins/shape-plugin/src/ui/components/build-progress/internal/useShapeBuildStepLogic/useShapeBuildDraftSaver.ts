import { useCallback } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { ShapeEntity } from '~/common/types/index';
import { notify } from '@hierarchidb/components/notify';
import { createBuildStartDraftData } from '~/ui/components/build-progress/createBuildStartDraftData';

type Args = {
  activeNodeId: NodeId | null;
  data?: Partial<ShapeEntity>;
  workerClient: WorkerClientRef | null;
};

export const useShapeBuildDraftSaver = ({ activeNodeId, data, workerClient }: Args) => {
  const saveDraftBeforeBuild = useCallback(async (patch?: Partial<ShapeEntity>) => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    if (!workerClient) {
      notify.error('Worker client is unavailable.');
      return false;
    }
    try {
      const api = workerClient.getAPI();
      const updater = await api.getTreeNodeUpdaterAPI();
      const node = await updater.getTreeNode(activeNodeId);
      const currentDraftData = (
        node?.draftData && typeof node.draftData === 'object'
          ? (node.draftData as Record<string, unknown>)
          : {}
      );
      await updater.updateTreeNode(activeNodeId, {
        mode: 'save-draft',
        draftData: createBuildStartDraftData({
          currentDraftData,
          liveData: data,
          patch,
        }),
      });
      return true;
    } catch (error) {
      notify.error('Failed to save draft.');
      console.error('[ShapeBuildProgressStep] save draft failed', error);
      return false;
    }
  }, [activeNodeId, data, workerClient]);

  return {
    saveDraftBeforeBuild,
  };
};

