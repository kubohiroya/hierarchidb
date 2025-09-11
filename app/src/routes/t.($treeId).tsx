import { type LoaderFunctionArgs, Outlet, useLoaderData, useNavigate } from 'react-router';
import { Suspense, useEffect, useState } from 'react';
import {
  AppBar,
  Box,
  CircularProgress,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from '@mui/material';
import { AccountTree as TreeIcon, Folder as FolderIcon, Map as MapIcon } from '@mui/icons-material';
import AppLogoIcon from '~/components/AppLogoIcon';
import { loadTree, type LoadTreeArgs, type LoadTreeReturn } from '~/loader';
import { TreeConsoleIntegration } from '~/components/TreeConsoleIntegration';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { LanguageSelector } from '~/components/LanguageSelector';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { Tree } from '@hierarchidb/common-type';

export async function clientLoader(args: LoaderFunctionArgs) {
  console.log('[t.($treeId).tsx] clientLoader called with params:', args.params);
  const { treeId } = args.params as LoadTreeArgs;

  try {
    const treeData = await loadTree({ treeId });

    console.log('[t.($treeId).tsx] Loaded tree data:', treeData);

    // If tree doesn't exist, throw an error
    if (!treeData.tree) {
      throw new Error(`Tree with ID '${treeId}' does not exist`);
    }

    if (treeData.tree?.rootId) {
      // Use facade pattern: get QueryAPI first
      const queryAPI = await treeData.client.getQueryAPI();
      const rootNode = await queryAPI.getNode(treeData.tree.rootId);
      console.log('[t.($treeId).tsx] Loaded root node:', rootNode);
      return {
        ...treeData,
        rootNode,
      };
    }
    return treeData;
  } catch (error) {
    console.error('[t.($treeId).tsx] clientLoader error:', error);
    throw error;
  }
}

type TLayoutLoaderData = LoadTreeReturn & { rootNode?: import('@hierarchidb/common-type').TreeNode };

export default function TLayout() {
  console.log('[TLayout] Component rendering');
  const data = useLoaderData() as TLayoutLoaderData;
  console.log('[TLayout] Loader data:', data);

  const navigate = useNavigate();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(data?.tree?.id || null);
  // Load available trees
  useEffect(() => {
    const loadTrees = async () => {
      try {
        console.log('[TreePage] Loading trees...');
        const client = await WorkerAPIClient.getSingleton();
        console.log('[TreePage] WorkerAPIClient obtained:', client);

        console.log('[TreePage] Client obtained:', client);

        // Use facade pattern: get QueryAPI first
        const queryAPI = await client.getQueryAPI();
        console.log('[TreePage] QueryAPI obtained:', queryAPI);

        const availableTrees = await queryAPI.listTrees();
        console.log('[TreePage] Trees loaded:', availableTrees);
        setTrees(availableTrees);
      } catch (error) {
        console.error('Failed to load trees:', error);
        console.error('Error stack:', (error as Error)?.stack);
      }
    };
    loadTrees();
  }, []);

  // Update selected tree when route changes
  useEffect(() => {
    if (data.tree?.id) {
      setSelectedTreeId(data.tree.id);
    }
  }, [data.tree?.id]);

  // Handle tree switch
  const handleTreeChange = (_event: React.MouseEvent<HTMLElement>, newTreeId: string | null) => {
    if (newTreeId && newTreeId !== selectedTreeId) {
      setSelectedTreeId(newTreeId);
      // Navigate to the new tree's root
      navigate(`/t/${newTreeId}`);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* AppBar with TreeTypes Switcher and UserLoginButton */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          {/* HierarchiDB Icon - Left side, navigates to top page */}
          <IconButton
            onClick={() => navigate('/')}
            edge="start"
            color="primary"
            aria-label="Go to HierarchiDB home"
            sx={{ mr: 2 }}
          >
            <AppLogoIcon size={28} />
          </IconButton>

          {/* TreeTypes Title */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
            {data.tree?.name || 'TreeTypes Console'}
          </Typography>

          {/* Spacer to push buttons to the right */}
          <Box sx={{ flexGrow: 1 }} />

          {/* TreeTypes Switcher Button Group - Right side, before login button */}
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
              {/* Sort trees to show Resources first, then Projects */}
              {trees
                .sort((a, b) => {
                  // Resources first, then Projects
                  const aIsResource = a.name.toLowerCase().includes('resource');
                  const bIsResource = b.name.toLowerCase().includes('resource');
                  if (aIsResource && !bIsResource) return -1;
                  if (!aIsResource && bIsResource) return 1;
                  return 0;
                })
                .map((tree) => (
                  <ToggleButton key={tree.id} value={tree.id} aria-label={tree.name}>
                    {tree.name.toLowerCase().includes('project') ? (
                      <FolderIcon sx={{ mr: 1, fontSize: 20 }} />
                    ) : tree.name.toLowerCase().includes('resource') ? (
                      <MapIcon sx={{ mr: 1, fontSize: 20 }} />
                    ) : (
                      <TreeIcon sx={{ mr: 1, fontSize: 20 }} />
                    )}
                    {tree.name}
                  </ToggleButton>
                ))}
            </ToggleButtonGroup>

            <LanguageSelector />
            {/* User Login Button - Right Aligned with 8px gap */}
            <Box sx={{ ml: '8px' }}>
              <UserLoginButton />
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* TreeConsole Integration - showing tree root when pageNodeId is not specified */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
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
          <TreeConsoleIntegration
            treeId={data?.tree?.id}
            pageNodeId={data?.tree?.rootId}
            pageTreeNode={data?.rootNode}
          />
        </Suspense>
      </Box>

      {/* Child Routes */}
      <Outlet />
    </Box>
  );
}
