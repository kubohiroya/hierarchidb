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
  Button,
} from '@mui/material';
import { AccountTree as TreeIcon, Folder as FolderIcon, Map as MapIcon } from '@mui/icons-material';
import { loadPageNode, LoadPageNodeArgs } from '~/loader';
import { TreeConsoleIntegration } from '~/components/TreeConsoleIntegration';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { WorkerAPIClient } from '../WorkerAPIClient';
import { Tree, type NodeId } from '@hierarchidb/common-core';

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadPageNodeArgs;

  // pageNodeIdが省略された場合、デフォルトのルートノードIDを設定
  const pageNodeId = params.nodeId || (`${params.treeId}Root` as NodeId);

  // undefinedという文字列の場合もデフォルト値に置き換え
  const actualPageNodeId =
    pageNodeId === 'undefined' ? (`${params.treeId}Root` as NodeId) : pageNodeId;

  return await loadPageNode({
    ...params,
    nodeId: actualPageNodeId,
  });
}

export default function TLayout() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string>(data.tree?.id || '');
  
  // Check if the node exists
  const nodeNotFound = data.pageNode === undefined && data.tree !== undefined;

  // Load available trees
  useEffect(() => {
    const loadTrees = async () => {
      try {
        const client = await WorkerAPIClient.getSingleton();
        // Use facade pattern: get QueryAPI first
        const queryAPI = await client.getQueryAPI();
        const availableTrees = await queryAPI.listTrees();
        setTrees(availableTrees);
      } catch (error) {
        console.error('Failed to load trees:', error);
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
          {/* TreeTypes Title */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
            {data.pageNode?.name || 'TreeTypes Console'}
          </Typography>

          {/* TreeTypes Switcher Button Group */}
          <Stack direction="row" spacing={2} sx={{ flexGrow: 1 }}></Stack>

          {/* User Login Button - Right Aligned */}
          <Box sx={{ ml: 'auto' }}>
            ⭐️
            <ToggleButtonGroup
              value={selectedTreeId}
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
            <UserLoginButton />
          </Box>
        </Toolbar>
      </AppBar>

      {/* TreeConsole Integration or Error Message */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {nodeNotFound ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h5" color="error">
              Node Not Found
            </Typography>
            <Typography variant="body1" color="textSecondary">
              The requested node does not exist.
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Node ID: {data.pageNodeId || 'Unknown'}
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate(`/t/${data.tree?.id || 'r'}`)}
              sx={{ mt: 2 }}
            >
              Go to Tree Root
            </Button>
          </Box>
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
            <TreeConsoleIntegration
              treeId={data.tree?.id}
              pageNodeId={data.pageNodeId}
              pageTreeNode={data.pageNode}
            />
          </Suspense>
        )}
      </Box>

      {/* Child Routes */}
      <Outlet />
    </Box>
  );
}
