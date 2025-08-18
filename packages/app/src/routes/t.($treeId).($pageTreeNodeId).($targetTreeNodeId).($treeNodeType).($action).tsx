import { Outlet, useLoaderData } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTreeNodeAction, LoadTreeNodeActionArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTreeNodeAction(args.params as LoadTreeNodeActionArgs);
}

export default function TLayout() {
  const data = useLoaderData();
  if (!data.action) {
    return;
  }
  return (
    <div>
      <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
        <h5>Route Parameters</h5>
        <ul>
          <li>
            <strong>Tree ID:</strong> {data.tree.treeId || 'Not provided'}
          </li>
          <li>
            <strong>Page Tree Node ID:</strong> {data.pageTreeNode.treeNodeId || 'Not provided'}
          </li>
          <li>
            <strong>Target Tree Node ID:</strong> {data.targetTreeNode.treeNodeId || 'Not provided'}
          </li>
          <li>
            <strong>Tree Node Type:</strong> {data.treeNodeType || 'Not provided'}
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
