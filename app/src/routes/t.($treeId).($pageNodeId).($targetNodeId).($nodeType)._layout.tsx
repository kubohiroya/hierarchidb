import { LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { loadNodeType } from '~/loader.js';

type LoaderData = Awaited<ReturnType<typeof clientLoader>>;

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { treeId, pageNodeId, targetNodeId, nodeType } = params;
  if (!treeId || !pageNodeId || !targetNodeId || !nodeType) {
    throw new Response('Missing route parameters.', { status: 400 });
  }
  return await loadNodeType({ treeId, pageNodeId, targetNodeId, nodeType });
}

export default function TLayout() {
  const data = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const { tree, pageNodeId, targetNodeId, targetNode } = data;
  const notFound = targetNode === undefined;
  const fallbackTreeId = tree?.id ?? 'r';
  const [open, setOpen] = useState<boolean>(notFound);

  useEffect(() => {
    setOpen(notFound);
  }, [notFound]);

  const goToPageNode = () => {
    navigate(`/t/${fallbackTreeId}/${pageNodeId}`);
  };

  return (
    <>
      {notFound && (
        <Dialog open={open} onClose={goToPageNode}>
          <DialogTitle>Node Not Found</DialogTitle>
          <DialogContent>
            <Typography>Node Not Found: ({targetNodeId ?? 'Unknown'})</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={goToPageNode} variant="contained" autoFocus>
              Go to Page Node
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Outlet />
    </>
  );
}
