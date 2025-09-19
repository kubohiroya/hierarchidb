import { LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { loadTargetNode, LoadTargetNodeArgs } from '~/loader.js';

export async function clientLoader(args: LoaderFunctionArgs) {
  // Don't load if targetNodeId is undefined
  if (!args.params.targetNodeId || !args.params.targetNodeId) {
    return null;
  }
  return await loadTargetNode(args.params as LoadTargetNodeArgs);
}

export default function TLayout() {
  const data = useLoaderData() as (Awaited<ReturnType<typeof clientLoader>> | null) & { tree?: any, pageNodeId?: string, targetNodeId?: string };
  const navigate = useNavigate();
  const notFound = !!data && typeof (data as any) === 'object' && 'targetNode' in (data as any) && (data as any).targetNode === undefined;
  const treeId = (data as any)?.tree?.id;
  const pageNodeId = (data as any)?.pageNodeId;
  const targetNodeId = (data as any)?.targetNodeId;
  const [open, setOpen] = useState<boolean>(notFound);
  useEffect(() => { setOpen(notFound); }, [notFound]);

  return (
    <>
      {notFound && (
        <Dialog open={open} onClose={() => navigate(`/t/${treeId || 'r'}/${pageNodeId || ''}`)}>
          <DialogTitle>Node Not Found</DialogTitle>
          <DialogContent>
            <Typography>Node Not Found: ({targetNodeId || 'Unknown'})</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => navigate(`/t/${treeId || 'r'}/${pageNodeId || ''}`)} variant="contained" autoFocus>
              Go to Page Node
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Outlet />
    </>
  );
}
