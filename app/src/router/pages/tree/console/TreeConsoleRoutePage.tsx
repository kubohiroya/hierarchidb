import type { OpenMaintenanceContext } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalBootProgress } from '~/contexts/BootProgressProvider';
import { useWorker } from '~/contexts/WorkerProvider';
import { createMaintenanceSessionUrl } from '~/maintenance/maintenanceSession';
import { treeRouteIds } from '~/router/routes/tree/treeRouteIds';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { MemoizedTreeConsoleIntegration } from './TreeConsoleIntegrationLoader';
import { useTreeConsoleDocumentTitle } from './hooks/useTreeConsoleDocumentTitle';
import { useTreeTargetContextState } from './hooks/useTreeTargetContextState';
import { TreeConsoleRoutePageLayout } from './TreeConsoleRoutePageLayout';
import { TreeConsoleRoutePageProviders } from './TreeConsoleRoutePageProviders';

type TreeConsoleRoutePageProps = {
  data: LoadPageNodeReturn;
  viewMode?: string;
  sortMode?: string;
};

export function TreeConsoleRoutePage({ data, viewMode: propViewMode, sortMode: propSortMode }: TreeConsoleRoutePageProps) {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { view?: string; sort?: string; zoom?: number };
  // Path params take priority over query params
  const resolvedViewMode = propViewMode ?? searchParams.view;
  const resolvedSortMode = propSortMode ?? searchParams.sort;
  const { client: workerClient } = useWorker();
  const bootProgress = useOptionalBootProgress();
  const matches = useRouterState({ select: (state) => state.matches });
  const dialogRouteIds = useMemo(
    () => [treeRouteIds.dialog, treeRouteIds.dialogMode, treeRouteIds.dialogModeStep],
    []
  );
  const targetMatch = useMemo(() => matches.find((match) => match.routeId === treeRouteIds.target), [matches]);
  const dialogMatch = useMemo(
    () => matches.find((match) => dialogRouteIds.includes(match.routeId)),
    [dialogRouteIds, matches]
  );
  const isUserMenuReady = Boolean(
    bootProgress?.steps.Auth.done && bootProgress?.steps.Theme.done && bootProgress?.steps.I18n.done
  );
  useTreeConsoleDocumentTitle();

  const nodeNotFound = data.pageNode === undefined && data.tree !== undefined;
  const [notFoundOpen, setNotFoundOpen] = useState<boolean>(nodeNotFound);
  useEffect(() => {
    setNotFoundOpen(nodeNotFound);
  }, [nodeNotFound]);

  useEffect(() => {
    if (!workerClient) return;
    void (async () => {
      try {
        const queryAPI = await workerClient.getQueryAPI();
        const availableTrees = await queryAPI.listTrees();
        if (!availableTrees.some((tree) => tree.id === 'r')) {
          console.warn('[TreePageLayout] Resources tree not found in available trees');
        }
      } catch (err) {
        console.warn('[TreePageLayout] failed to list trees', err);
      }
    })();
  }, [workerClient]);

  const pageName = data.pageNode?.metadata?.name || data.tree?.name || 'TreeTypes Console';
  const handleOpenMaintenance = (context: OpenMaintenanceContext) => {
    if (typeof window === 'undefined') return;
    const { url } = createMaintenanceSessionUrl({
      expectedEmail: context.userEmail,
    });
    window.location.assign(url);
  };

  const targetContext = useTreeTargetContextState(dialogMatch?.loaderData, targetMatch?.loaderData);
  const dialogStableKeyRef = useRef(`${data.tree?.id ?? ''}:${data.pageNodeId ?? ''}`);
  const treeRootPath = `/d/${data.tree?.id ?? 'r'}`;

  return (
    <TreeConsoleRoutePageProviders data={data} targetContext={targetContext}>
      <TreeConsoleRoutePageLayout
        data={data}
        pageName={pageName}
        isUserMenuReady={isUserMenuReady}
        nodeNotFound={nodeNotFound}
        notFoundOpen={notFoundOpen}
        onGoHome={() => navigate({ to: '/' })}
        onGoToTreeRoot={() => navigate({ to: treeRootPath })}
        onGoToTreeRootWithReplace={() =>
          navigate({
            to: treeRootPath,
            replace: true,
          })
        }
        onOpenMaintenance={handleOpenMaintenance}
      >
        <MemoizedTreeConsoleIntegration
          key={dialogStableKeyRef.current}
          treeId={data.tree?.id}
          pageNodeId={data.pageNodeId}
          pageTreeNode={data.pageNode}
          initialViewMode={resolvedViewMode as import('@hierarchidb/ui-treeconsole-base').ViewMode | undefined}
          initialSortMode={resolvedSortMode as import('@hierarchidb/ui-treeconsole-base').SortMode | undefined}
          initialZoomLevel={searchParams.zoom}
        />
      </TreeConsoleRoutePageLayout>
    </TreeConsoleRoutePageProviders>
  );
}
