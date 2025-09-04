import { Outlet, useLoaderData, useSearchParams } from 'react-router';
import type { Tree, TreeNode } from '@hierarchidb/common-type';
import type { LoaderFunctionArgs } from 'react-router';
import { loadNodeAction, LoadNodeActionArgs } from '~/loader';
import TrashDialog, { clientLoader as trashDialogClientLoader } from '~/components/dialogs/TrashDialog';

export async function clientLoader(args: LoaderFunctionArgs) {
  const data = await loadNodeAction(args.params as LoadNodeActionArgs);

  // If the action is 'trash', also load data for the TrashDialog
  if (String(data.action) === 'trash') {
    const trashData = await trashDialogClientLoader(args);
    return { ...data, ...trashData };
  }

  return data;
}

type ActionLoaderData = {
  action?: string;
  nodeType?: string;
  tree?: Tree;
  pageTreeNode?: TreeNode;
  targetTreeNode?: TreeNode;
};

export default function TLayout() {
  const data = useLoaderData() as ActionLoaderData;
  const [searchParams] = useSearchParams();

  if (!data.action) {
    return <Outlet />;
  }

  if (data.action === 'trash') {
    const mode = searchParams.get('mode') || 'restore';
    // The TrashDialog component itself will handle its own rendering as a Dialog
    // We just need to ensure it's rendered when the action is 'trash'
    return <TrashDialog />;
  }

  return (
    <div>
      <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
        <h5>Route Parameters</h5>
        <ul>
          <li>
            <strong>Tree ID:</strong> {data.tree?.id || 'Not provided'}
          </li>
          <li>
            <strong>Page Tree Node ID:</strong> {data.pageTreeNode?.id || 'Not provided'}
          </li>
          <li>
            <strong>Target Tree Node ID:</strong> {data.targetTreeNode?.id || 'Not provided'}
          </li>
          <li>
            <strong>Tree Node Type:</strong> {data.nodeType || 'Not provided'}
          </li>
          <li>
            <strong>Action:</strong> {data.action || 'Not provided'}
          </li>
        </ul>
      </div>
      <Outlet />
    </div>
  );
}
