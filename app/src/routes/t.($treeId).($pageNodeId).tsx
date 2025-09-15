import { type LoaderFunctionArgs } from 'react-router';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLoaderData, useNavigate } from 'react-router';
import { AppBar, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, ToggleButton, ToggleButtonGroup, Toolbar, Typography } from '@mui/material';
import { AccountTree as TreeIcon, Folder as FolderIcon } from '@mui/icons-material';
import { loadPageNode, type LoadPageNodeArgs } from '~/loader';
import { TreeConsoleIntegration } from '~/components/TreeConsoleIntegration';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { NodeId, Tree } from '@hierarchidb/common-type';

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadPageNodeArgs;
  const pageNodeId = params.pageNodeId || (`${params.treeId}:root` as NodeId);
  return await loadPageNode({ ...params, pageNodeId });
}

export default function TLayout() {
  const data = useLoaderData() as Awaited<ReturnType<typeof clientLoader>>;
  const navigate = useNavigate();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string>(data.tree?.id || '');

  const nodeNotFound = data.pageNode === undefined && data.tree !== undefined;
  const [notFoundOpen, setNotFoundOpen] = useState<boolean>(nodeNotFound);
  useEffect(() => { setNotFoundOpen(nodeNotFound); }, [nodeNotFound]);

  useEffect(() => {
    const loadTrees = async () => {
      try {
        const client = await WorkerAPIClient.getSingleton();
        const queryAPI = await client.getQueryAPI();
        const availableTrees = await queryAPI.listTrees();
        setTrees(availableTrees);
      } catch {}
    };
    loadTrees();
  }, []);

  useEffect(() => {
    if (data.tree?.id) setSelectedTreeId(data.tree.id);
  }, [data.tree?.id]);

  const handleTreeChange = (_e: React.MouseEvent<HTMLElement>, newTreeId: string | null) => {
    if (newTreeId && newTreeId !== selectedTreeId) {
      setSelectedTreeId(newTreeId);
      navigate(`/t/${newTreeId}`);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
            {data.pageNode?.name || 'TreeTypes Console'}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ flexGrow: 1 }} />
          <Box sx={{ ml: 'auto' }}>
            <ToggleButtonGroup value={selectedTreeId} exclusive onChange={handleTreeChange} size="small">
              {trees.map((tree) => (
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
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {nodeNotFound ? (
          <Dialog open={notFoundOpen} onClose={() => navigate(`/t/${data.tree?.id || 'r'}`)}>
            <DialogTitle>Node Not Found</DialogTitle>
            <DialogContent>
              <Typography>Node Not Found: ({data.pageNodeId || 'Unknown'})</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => navigate(`/t/${data.tree?.id || 'r'}`)} variant="contained" autoFocus>
                Go to Tree Root
              </Button>
            </DialogActions>
          </Dialog>
        ) : (
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>}>
            <TreeConsoleIntegration
              key={`${data.tree?.id || ''}:${data.pageNodeId || ''}`}
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
  );
}

export function shouldRevalidate(args: any) {
  try {
    return args.currentParams?.pageNodeId !== args.nextParams?.pageNodeId || args.currentParams?.treeId !== args.nextParams?.treeId;
  } catch {
    return true;
  }
}
