import { Outlet, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import { Suspense, useState, useEffect } from 'react';
import {
  Box,
  CircularProgress,
  AppBar,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Stack,
} from '@mui/material';
import { AccountTree as TreeIcon, Folder as FolderIcon, Map as MapIcon } from '@mui/icons-material';
import { loadTree, LoadTreeArgs } from '~/loader';
import { TreeConsoleIntegration } from '~/components/TreeConsoleIntegration';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { Tree } from '@hierarchidb/common-core';

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
    const rootNode = await treeData.client.getNode(treeData.tree.rootId);
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

export default function TLayout() {
  console.log('[TLayout] Component rendering');
  const data = useLoaderData() as any; // Type workaround for rootNode property
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
        console.log('[TreePage] Client getTrees method:', typeof client.getTrees);
        
        const availableTrees = await client.getTrees();
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
      {/* AppBar with Tree Switcher and UserLoginButton */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          {/* Tree Title */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
            {data.tree?.name || 'Tree Console'}
          </Typography>

          {/* Tree Switcher Button Group */}
          <Stack direction="row" spacing={2} sx={{ flexGrow: 1 }}>
            <ToggleButtonGroup
              value={selectedTreeId || undefined}
              exclusive
              onChange={handleTreeChange}
              aria-label="tree selection"
              size="small"
            >
              {trees.map((tree) => (
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
          </Stack>

          {/* User Login Button - Right Aligned */}
          <Box sx={{ ml: 'auto' }}>
            <UserLoginButton />
          </Box>
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
