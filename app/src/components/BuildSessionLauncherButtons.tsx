import { useCallback, useMemo } from 'react';
import { type NodeId, type TreeId, toNodeType } from '@hierarchidb/core-types';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useWorker } from '~/contexts/WorkerProvider';
import { startBuildFlow } from '~/router/pages/tree/console/buildFlow';
import { openInNewTab } from '~/utils/openInNewTab';
import { BuildSessionQueueList, type BuildSessionQueueEntry } from '~/components/BuildSessionQueueList';

type BuildSessionLauncherButtonsProps = {
  treeId?: TreeId;
  pageNodeId?: NodeId;
};

export function BuildSessionLauncherButtons({ treeId, pageNodeId }: BuildSessionLauncherButtonsProps) {
  const navigate = useNavigate();
  const { client: workerClient } = useWorker();
  const location = useRouterState({ select: (state) => state.location });
  const returnTo = useMemo(() => `${location.pathname}${location.searchStr ?? ''}`,
    [location.pathname, location.searchStr]
  );

  const handleNavigateToBuild = useCallback(async (entry: BuildSessionQueueEntry, options?: { openInNewTab?: boolean }) => {
    if (!treeId || !pageNodeId || !workerClient) return;
    const targetNode = entry.node
      ?? await workerClient.getQueryAPI().then((queryAPI) => queryAPI.getNode(entry.session.nodeId)).catch(() => null);

    if (!targetNode) {
      return;
    }

    await startBuildFlow({
      treeId,
      pageNodeId,
      node: targetNode,
      returnTo,
      workerClient,
      navigate: (to) => {
        if (options?.openInNewTab) {
          openInNewTab(to);
          return;
        }
        navigate({ to });
      },
    });
  }, [navigate, pageNodeId, returnTo, treeId, workerClient]);

  return (
    <BuildSessionQueueList
      nodeType={toNodeType('shape')}
      onNavigateToBuild={handleNavigateToBuild}
    />
  );
}
