import type { Tree } from '@hierarchidb/common-types';
import { UserLoginButton } from '@hierarchidb/ui-shell/ui-usermenu';
import { Folder as FolderIcon, AccountTree as TreeIcon } from '@mui/icons-material';
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
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from '@mui/material';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import { Outlet, useLoaderData, useNavigate } from '@tanstack/react-router';
import type { MouseEvent, ReactNode } from 'react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import AppLogoIcon from '~/components/AppLogoIcon.js';
import { useOptionalBootProgress } from '~/contexts/BootProgressProvider.js';
import { useWorker } from '~/contexts/WorkerProvider.js';
import type { LoadPageNodeReturn } from '../loaders/treeLoaders.js';

const LazyTreeConsoleIntegration = lazy(async () => {
  const mod = await import('~/router/pages/tree/console/TreeConsoleIntegration.js');
  return { default: mod.TreeConsoleIntegration };
});

type LoaderData = LoadPageNodeReturn;

type TreeLayoutBodyProps = {
  data: LoaderData;
};

export default function TLayout() {
  const data = useLoaderData({ from: '/t/$treeId/$pageNodeId' }) as LoaderData;
  return <TreeLayoutBody data={data} />;
}

export function TreeLayoutBody({ data }: TreeLayoutBodyProps) {
  const navigate = useNavigate();
  const { client: workerClient } = useWorker();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(data.tree?.id || null);
  const bootProgress = useOptionalBootProgress();
  const isUserMenuReady = Boolean(
    bootProgress?.steps.Auth.done && bootProgress?.steps.Theme.done && bootProgress?.steps.I18n.done
  );

  const nodeNotFound = data.pageNode === undefined && data.tree !== undefined;
  const [notFoundOpen, setNotFoundOpen] = useState<boolean>(nodeNotFound);
  useEffect(() => {
    setNotFoundOpen(nodeNotFound);
  }, [nodeNotFound]);

  useEffect(() => {
    const loadTrees = async () => {
      if (!workerClient) return;
      try {
        const queryAPI = await workerClient.getQueryAPI();
        const availableTrees = await queryAPI.listTrees();
        setTrees(availableTrees);
      } catch (err) {
        console.warn('[TreePageLayout] failed to list trees', err);
      }
    };
    void loadTrees();
  }, [workerClient]);

  useEffect(() => {
    if (data.tree?.id) {
      setSelectedTreeId(data.tree.id);
    }
  }, [data.tree?.id]);

  const handleTreeChange = (_event: MouseEvent<HTMLElement>, newTreeId: string | null) => {
    if (newTreeId && newTreeId !== selectedTreeId) {
      setSelectedTreeId(newTreeId);
      navigate({ to: `/t/${newTreeId}` });
    }
  };

  const pageName =
    data.pageNode?.metadata?.name || data.tree?.name || 'TreeTypes Console';

  return (
    <TreeConsoleThemeBoundary treeId={data.tree?.id}>
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
              <ToggleButtonGroup
                value={selectedTreeId || undefined}
                exclusive
                onChange={handleTreeChange}
                aria-label="tree selection"
                size="small"
                sx={{
                  borderRadius: '24px',
                  '& .MuiToggleButton-root': {
                    px: 2,
                    py: 0.5,
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    borderRadius: 0,
                    '&:first-of-type': {
                      borderTopLeftRadius: '24px',
                      borderBottomLeftRadius: '24px',
                    },
                    '&:last-of-type': {
                      borderTopRightRadius: '24px',
                      borderBottomRightRadius: '24px',
                    },
                    '&:not(:first-of-type)': {
                      borderLeft: 'none',
                    },
                  },
                }}
              >
                {trees
                  .sort((a, b) => {
                    const aIsResource = a.name.toLowerCase().includes('resource');
                    const bIsResource = b.name.toLowerCase().includes('resource');
                    if (aIsResource && !bIsResource) return -1;
                    if (!aIsResource && bIsResource) return 1;
                    return 0;
                  })
                  .map((tree) => (
                    <ToggleButton key={tree.id} value={tree.id} aria-label={tree.name}>
                      {tree.name.toLowerCase().includes('project') ? (
                        <TreeIcon sx={{ mr: 1, fontSize: 20 }} />
                      ) : tree.name.toLowerCase().includes('resource') ? (
                        <FolderIcon sx={{ mr: 1, fontSize: 20 }} />
                      ) : (
                        <TreeIcon sx={{ mr: 1, fontSize: 20 }} />
                      )}
                      {tree.name}
                    </ToggleButton>
                  ))}
              </ToggleButtonGroup>

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
                  onClick={() => navigate({ to: `/t/${data.tree?.id ?? 'r'}`, replace: true })}
                  variant="contained"
                  autoFocus
                >
                  Go to Tree Root
                </Button>
              </DialogActions>
            </Dialog>
          ) : (
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
              <LazyTreeConsoleIntegration
                key={`${data.tree?.id ?? ''}:${data.pageNodeId ?? ''}`}
                treeId={data.tree?.id}
                pageNodeId={data.pageNodeId}
                pageTreeNode={data.pageNode}
              />
              {/* Nested routes (e.g. dialog) render here */}
              <Outlet />
            </Suspense>
          )}
        </Box>
      </Box>
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
