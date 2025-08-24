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
import { loadPageNode, LoadPageNodeArgs } from '~/loader';
import { TreeConsoleIntegration } from '~/components/TreeConsoleIntegration';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { WorkerAPIClient } from '@hierarchidb/ui-client';
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

  // Load available trees
  useEffect(() => {
    const loadTrees = async () => {
      try {
        const client = await WorkerAPIClient.getSingleton();
        const api = client.getAPI();
        const availableTrees = await api.getTrees();
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
      setSelectedTreeId(data.pageTreeNode.treeId);
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
            {data.pageTreeNode?.name || 'Tree Console'}
          </Typography>

          {/* Tree Switcher Button Group */}
          <Stack direction="row" spacing={2} sx={{ flexGrow: 1 }}>
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
          </Stack>

          {/* User Login Button - Right Aligned */}
          <Box sx={{ ml: 'auto' }}>
            <UserLoginButton />
          </Box>
        </Toolbar>
      </AppBar>

      {/* TreeConsole Integration */}
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
            treeId={data.tree?.id}
            pageNodeId={data.pageTreeNode?.id}
            pageTreeNode={data.pageTreeNode}
          />
        </Suspense>
      </Box>

      {/* Child Routes */}
      <Outlet />
    </Box>
  );
}
