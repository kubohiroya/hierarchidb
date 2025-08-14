import { Outlet, useParams } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTreeNodeAction, LoadTreeNodeActionArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTreeNodeAction(args.params as LoadTreeNodeActionArgs);
}

export default function TLayout() {
  const params = useParams() as LoadTreeNodeActionArgs;

  return (
    <div>
      <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
        <h2>Route Parameters</h2>
        <ul>
          <li><strong>Tree ID:</strong> {params.treeId || 'Not provided'}</li>
          <li><strong>Page Tree Node ID:</strong> {params.pageTreeNodeId || 'Not provided'}</li>
          <li><strong>Target Tree Node ID:</strong> {params.targetTreeNodeId || 'Not provided'}</li>
          <li><strong>Tree Node Type:</strong> {params.treeNodeType || 'Not provided'}</li>
          <li><strong>Action:</strong> {params.action || 'Not provided'}</li>
        </ul>
      </div>
      <Outlet />
    </div>
  );
}
