import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import {
  BuildSessionRuntimeContextProvider,
  PageNodeContextProvider,
  TargetNodeBuildSessionContextProvider,
  TargetNodeContextProvider,
  TreeContextProvider,
} from '@hierarchidb/ui-batch-progress';
import {
  type OpenMaintenanceContext,
  UserLoginButton,
} from '@hierarchidb/ui-plugin-shell/ui-usermenu';
import { useTranslation } from '@hierarchidb/ui-i18n';
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
import type { i18n as I18nInstance } from 'i18next';
import AppLogoIcon from '~/components/AppLogoIcon';
import { BuildSessionLauncherButtons } from '~/components/BuildSessionLauncherButtons';
import { useOptionalBootProgress } from '~/contexts/BootProgressProvider';
import { useWorker } from '~/contexts/WorkerProvider';
import { createMaintenanceSessionUrl } from '~/maintenance/maintenanceSession';
import {
  resolveStepTitleFromRegistry,
  type StepTitleTranslator,
} from '@hierarchidb/plugin-registry/derivations';
import { pluginRegistry } from '~/plugin-loaders/index';
import { resolveTreePageTitle, useAppDocumentTitle } from '~/router/title/pageTitle';
import type { TreeConsoleIntegrationProps } from '~/router/pages/tree/console/TreeConsoleIntegration';
import type {
  LoadNodeActionReturn,
  LoadPageNodeReturn,
  LoadTargetNodeReturn,
} from '~/router/loaders/treeLoaders';
import { treeRouteIds } from './tree/shared.js';

const LazyTreeConsoleIntegration = lazy(async () => {
  const mod = await import('~/router/pages/tree/console/TreeConsoleIntegration');
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
  kind?: 'archive' | 'plugin';
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
  const { i18n } = useTranslation();
  const i18nReadyVersion = useI18nReadyVersion(i18n);
  const translateStepTitle = useMemo<StepTitleTranslator>(
    () => (namespace, key) => {
      if (!i18n.exists(key, { ns: namespace })) {
        return '';
      }
      const translated = String(i18n.t(key, { ns: namespace }));
      return translated === key ? '' : translated;
    },
    [i18n, i18nReadyVersion]
  );
  const resolveStepTitle = useMemo(
    () => (nodeType: string, step: number) =>
      resolveStepTitleFromRegistry(pluginRegistry, nodeType, step, translateStepTitle),
    [translateStepTitle]
  );
  const nextTitle = useMemo(
    () => resolveTreePageTitle(matches, { resolveStepTitle }),
    [matches, resolveStepTitle]
  );
  useAppDocumentTitle(nextTitle);
}

function useI18nReadyVersion(i18n: I18nInstance): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => {
      setVersion((current) => current + 1);
    };

    i18n.on('initialized', bump);
    i18n.on('loaded', bump);

    return () => {
      i18n.off('initialized', bump);
      i18n.off('loaded', bump);
    };
  }, [i18n]);

  return version;
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
  const handleOpenMaintenance = (context: OpenMaintenanceContext) => {
    if (typeof window === 'undefined') return;
    const { url } = createMaintenanceSessionUrl({
      expectedEmail: context.userEmail,
    });
    window.location.assign(url);
  };

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
                            <UserLoginButton onOpenMaintenance={handleOpenMaintenance} />
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
