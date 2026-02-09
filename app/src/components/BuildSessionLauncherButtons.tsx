import { useCallback, useMemo } from 'react';
import { type NodeId, type TreeId, toNodeType } from '@hierarchidb/core-types';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { BuildSessionLauncherPanel, type BuildSessionLauncherEntry } from '@hierarchidb/ui-batch-progress';
import { useWorker } from '~/contexts/WorkerProvider.js';
import { startBuildFlow } from '~/router/pages/tree/console/buildFlow.ts';
import { openInNewTab } from '~/utils/openInNewTab.ts';

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

  const handleNavigateToBuild = useCallback(
    async (entry: BuildSessionLauncherEntry, options?: { openInNewTab?: boolean }) => {
      if (!treeId || !pageNodeId || !workerClient) return;
      if (!entry.node?.id) return;
      await startBuildFlow({
        treeId,
        pageNodeId,
        node: entry.node,
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
    },
    [navigate, pageNodeId, returnTo, treeId, workerClient]
  );

  return (
    <BuildSessionLauncherPanel
      nodeType={toNodeType('shape')}
      onNavigateToBuild={handleNavigateToBuild}
    />
  );
}
