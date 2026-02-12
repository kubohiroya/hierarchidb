import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import {
  BuildSessionRuntimeContextProvider,
  PageNodeContextProvider,
  TargetNodeBuildSessionContextProvider,
  TargetNodeContextProvider,
  TreeContextProvider,
} from '@hierarchidb/ui-batch-progress';
import { UserLoginButton } from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import { Outlet, useLoaderData, useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import AppLogoIcon from '~/components/AppLogoIcon.js';
import { BuildSessionLauncherButtons } from '~/components/BuildSessionLauncherButtons.js';
import { useOptionalBootProgress } from '~/contexts/BootProgressProvider.js';
import { useWorker } from '~/contexts/WorkerProvider.js';
import type { TreeConsoleIntegrationProps } from '~/router/pages/tree/console/TreeConsoleIntegration.js';
import type {
  LoadNodeActionReturn,
  LoadPageNodeReturn,
  LoadTargetNodeReturn,
} from '../loaders/treeLoaders.js';
import { treeRouteIds } from './tree/shared.js';

const LazyTreeConsoleIntegration = lazy(async () => {
  const mod = await import('~/router/pages/tree/console/TreeConsoleIntegration.js');
  return { default: mod.TreeConsoleIntegration };
});

const MemoizedTreeConsoleIntegration = memo<TreeConsoleIntegrationProps>(
  (props) => <LazyTreeConsoleIntegration {...props} />,
  (prev, next) =>
    prev.treeId === next.treeId &&
    prev.pageNodeId === next.pageNodeId &&
    (prev.pageTreeNode?.id ?? null) === (next.pageTreeNode?.id ?? null)
);

type LoaderData = LoadPageNodeReturn;

type TreeLayoutBodyProps = {
  data: LoaderData;
};

type TreeDialogMatchData = {
  kind?: 'trash' | 'plugin';
  data?: unknown;
  params?: { action?: string; nodeType?: string };
};

type TargetContextState = {
  targetNodeId: NodeId | null;
  targetNode: TreeNode | null;
  targetNodeType: string | null;
};

function useTreeDocumentTitle() {
  const matches = useRouterState({ select: (state) => state.matches });

  const pageMatch = useMemo(
    () => matches.find((match) => match.routeId === treeRouteIds.page),
    [matches]
  );
  const targetMatch = useMemo(
    () => matches.find((match) => match.routeId === treeRouteIds.target),
    [matches]
  );
  const dialogRouteIds = useMemo(
    () => [treeRouteIds.dialog, treeRouteIds.dialogMode, treeRouteIds.dialogModeStep],
    []
  );
  const dialogMatch = useMemo(
    () => matches.find((match) => dialogRouteIds.includes(match.routeId)),
    [dialogRouteIds, matches]
  );

  const nextTitle = useMemo(() => {
    const defaultTitle = 'HierarchiDB App';

    const dialogData = dialogMatch?.loaderData as TreeDialogMatchData | undefined;
    if (dialogData?.kind === 'plugin') {
      const { targetNode, params } = dialogData.data as LoadNodeActionReturn & {
        params?: { action?: string; nodeType?: string };
      };
      const dialogTargetName = targetNode?.metadata?.name;
      if (dialogTargetName && params?.action && params?.nodeType) {
        return `${dialogTargetName} (${params.action} ${params.nodeType})`;
      }
    }

    const targetData = targetMatch?.loaderData as LoadTargetNodeReturn | undefined;
    const targetTitle = targetData?.targetNode?.metadata?.name;
    if (targetTitle) {
      return targetTitle;
    }

    const pageData = pageMatch?.loaderData as LoadPageNodeReturn | undefined;
    const pageTitle = pageData?.pageNode?.metadata?.name ?? pageData?.tree?.name;
    if (pageTitle) {
      return pageTitle;
    }

    return defaultTitle;
  }, [dialogMatch?.loaderData, targetMatch?.loaderData, pageMatch?.loaderData]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = nextTitle;
  }, [nextTitle]);
}

export default function TLayout() {
  const data = useLoaderData({ from: '/t/$treeId/$pageNodeId' }) as LoaderData;
  return <TreeLayoutBody data={data} />;
}

export function TreeLayoutBody({ data }: TreeLayoutBodyProps) {
  const navigate = useNavigate();
  const { client: workerClient } = useWorker();
  const bootProgress = useOptionalBootProgress();
  const matches = useRouterState({ select: (state) => state.matches });
  const dialogRouteIds = useMemo(
    () => [treeRouteIds.dialog, treeRouteIds.dialogMode, treeRouteIds.dialogModeStep],
    []
  );
  const targetMatch = useMemo(
    () => matches.find((match) => match.routeId === treeRouteIds.target),
    [matches]
  );
  const dialogMatch = useMemo(
    () => matches.find((match) => dialogRouteIds.includes(match.routeId)),
    [dialogRouteIds, matches]
  );
  const isUserMenuReady = Boolean(
    bootProgress?.steps.Auth.done && bootProgress?.steps.Theme.done && bootProgress?.steps.I18n.done
  );
  useTreeDocumentTitle();

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
  const targetContext = useMemo<TargetContextState>(() => {
    const dialogData = dialogMatch?.loaderData as TreeDialogMatchData | undefined;
    if (dialogData?.kind === 'plugin') {
      const pluginData = dialogData.data as
        | (LoadNodeActionReturn & { params?: { targetNodeId?: string; nodeType?: string } })
        | undefined;
      const pluginTargetNodeId = pluginData?.targetNodeId ?? pluginData?.params?.targetNodeId;
      return {
        targetNodeId: pluginTargetNodeId ? (pluginTargetNodeId as NodeId) : null,
        targetNode: pluginData?.targetNode ?? null,
        targetNodeType: pluginData?.nodeType ?? pluginData?.params?.nodeType ?? null,
      };
    }

    const targetData = targetMatch?.loaderData as LoadTargetNodeReturn | undefined;
    return {
      targetNodeId: targetData?.targetNodeId ?? null,
      targetNode: targetData?.targetNode ?? null,
      targetNodeType: targetData?.targetNode?.nodeType ?? null,
    };
  }, [dialogMatch?.loaderData, targetMatch?.loaderData]);

  const dialogStableKeyRef = useRef(`${data.tree?.id ?? ''}:${data.pageNodeId ?? ''}`);

  return (
    <TreeConsoleThemeBoundary treeId={data.tree?.id}>
      <TreeContextProvider treeId={data.tree?.id}>
        <PageNodeContextProvider pageNodeId={data.pageNodeId} pageNode={data.pageNode}>
          <TargetNodeContextProvider
            targetNodeId={targetContext.targetNodeId}
            targetNode={targetContext.targetNode}
            nodeType={targetContext.targetNodeType}
          >
            <BuildSessionRuntimeContextProvider>
              <TargetNodeBuildSessionContextProvider>
                <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                  <AppBar position="static" color="default" elevation={1}>
                    <Toolbar>
                      <IconButton
                        onClick={() => navigate({ to: '/' })}
                        edge="start"
                        color="primary"
                        aria-label="Go to HierarchiDB home"
                        sx={{ marginLeft: '-20px' }}
                      >
                        <AppLogoIcon size={28} />
                      </IconButton>

                      <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
                        {pageName}
                      </Typography>

                      <Box sx={{ flexGrow: 1 }} />

                      <Stack direction="row" spacing={1} alignItems="center">
                        {data.tree?.id ? (
                          <BuildSessionLauncherButtons
                            treeId={data.tree.id}
                            pageNodeId={data.pageNodeId}
                          />
                        ) : null}
                        {isUserMenuReady ? (
                          <Box sx={{ ml: '8px' }}>
                            <UserLoginButton />
                          </Box>
                        ) : null}
                      </Stack>
                    </Toolbar>
                  </AppBar>

                  <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    {nodeNotFound ? (
                      <Dialog
                        open={notFoundOpen}
                        onClose={() => navigate({ to: `/t/${data.tree?.id ?? 'r'}` })}
                      >
                        <DialogTitle>Node Not Found</DialogTitle>
                        <DialogContent>
                          <Typography>Node Not Found: ({data.pageNodeId ?? 'Unknown'})</Typography>
                        </DialogContent>
                        <DialogActions>
                          {/* Use router navigation to avoid coupling with e2e-only Playwright helpers */}
                          <Button
                            onClick={() =>
                              navigate({ to: `/t/${data.tree?.id ?? 'r'}`, replace: true })
                            }
                            variant="contained"
                            autoFocus
                          >
                            Go to Tree Root
                          </Button>
                        </DialogActions>
                      </Dialog>
                    ) : (
                      <>
                        <Suspense
                          fallback={
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '100%',
                              }}
                            >
                              <CircularProgress />
                            </Box>
                          }
                        >
                          <MemoizedTreeConsoleIntegration
                            key={dialogStableKeyRef.current}
                            treeId={data.tree?.id}
                            pageNodeId={data.pageNodeId}
                            pageTreeNode={data.pageNode}
                          />
                        </Suspense>
                        <Suspense fallback={null}>
                          {/* Nested routes (e.g. dialog) render here */}
                          <Outlet />
                        </Suspense>
                      </>
                    )}
                  </Box>
                </Box>
              </TargetNodeBuildSessionContextProvider>
            </BuildSessionRuntimeContextProvider>
          </TargetNodeContextProvider>
        </PageNodeContextProvider>
      </TreeContextProvider>
    </TreeConsoleThemeBoundary>
  );
}

function TreeConsoleThemeBoundary({ treeId, children }: { treeId?: string; children: ReactNode }) {
  const baseTheme = useTheme();

  const themed = useMemo(() => {
    if (treeId !== 'p') {
      return baseTheme;
    }

    return createTheme(baseTheme, {
      palette: {
        primary: { ...baseTheme.palette.secondary },
        secondary: { ...baseTheme.palette.primary },
      },
    });
  }, [baseTheme, treeId]);

  if (themed === baseTheme) {
    return <>{children}</>;
  }

  return <ThemeProvider theme={themed}>{children}</ThemeProvider>;
}
